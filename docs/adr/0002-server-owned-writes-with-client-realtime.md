# 2. Server-owned assistant writes, client-owned manual edits

Date: 2026-09-02
Status: Accepted

## Context

`/api/process` had no authentication. Anyone could POST to it and spend the
project's Gemini quota, and the task list to operate on came from the request
body — the server had no idea whose tasks it was editing. There were no
`firestore.rules` in the repository at all.

## Decision

- The route verifies a Firebase ID token and reads the caller's tasks from
  `users/{uid}/tasks` using the uid **in the token**. A client cannot name whose
  list is edited. The `tasks` field in the request body is honoured only for
  anonymous callers, whose list lives in their own browser anyway.
- Anonymous use is still allowed, under a much smaller rate limit, because the
  guest experience is a genuine part of the product.
- Rate limits are counted in a Firestore transaction rather than in memory:
  Cloud Run runs many instances and a per-instance counter limits nothing.
- Manual edits — the checkbox and the delete button — stay on the client, so
  they stay instant and optimistic. Assistant edits go through the server.
- `firestore.rules` is versioned, validates each field, and denies by default.
  The Admin SDK bypasses rules, which is what lets server writes coexist with
  rules strict enough to constrain the client.

## Consequences

Two writers, one collection. That is acceptable because they write disjoint
things at disjoint times: the client only ever touches `status` on a document it
is displaying, the server only writes documents an operation named, and both
paths converge through the same listener.

An unauthenticated request is treated as a guest rather than rejected, which
means an expired token degrades to guest mode instead of erroring. That is the
right behaviour for a chat someone is mid-conversation in.
