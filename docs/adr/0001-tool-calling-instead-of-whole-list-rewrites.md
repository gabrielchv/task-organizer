# 1. Tool calling instead of whole-list rewrites

Date: 2026-09-02
Status: Accepted

## Context

In the previous design every turn sent the user's entire task array to Gemini
and expected the entire updated array back inside a hand-written JSON envelope.
`syncFirestoreFromAI` then batched a `set` for every returned task and a
`delete` for every id that was _missing_ from the reply.

That makes the model the owner of the user's data. A truncated response, a
dropped item, a hallucinated array — any of them silently destroyed tasks the
user never asked to remove. There was no way to distinguish "the model chose to
delete this" from "the model forgot to mention it".

Two further problems came from the same root. Gemini refuses a request that
combines its built-in `googleSearch` tool with a `responseSchema`, so the
primary model was asked for JSON in prose. When that failed, a _second_ model
call (`reformatResponseWithSchema`) tried to repair the output. And the
tool-call loop never sent a `functionResponse` back — it re-sent the system
prompt as a fresh user message, so the model was never actually told what its
tool call returned.

## Decision

The model expresses intent as tool calls. The server owns state.

- Operations are a discriminated union: `add`, `update`, `set_status`, `delete`.
- `applyOperations` is pure and holds the invariant: a task disappears only for
  an explicit `delete` naming its id. An operation on an unknown id is rejected
  with a reason, never silently ignored and never turned into a create.
- The same Zod schema generates the Gemini function declaration and validates
  the arguments at runtime, so the contract cannot drift.
- `runAgent` sends real `functionResponse` parts, so failures are visible to the
  model and it can correct itself within the turn.
- `web_search` is our own declared function backed by a search provider, not
  Gemini's built-in tool, which removes the conflict that forced free-form JSON.

## Consequences

The repair model, the markdown-fence stripping and the `/\{[\s\S]*\}/`
extraction are all gone. Persistence writes only the documents an accepted
operation named.

The cost is one extra round trip when the model calls a tool before answering,
which streaming hides. Adding a capability now means writing a tool with a
schema rather than editing prose in two languages.
