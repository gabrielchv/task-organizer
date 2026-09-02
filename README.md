# Task Helper AI

An AI chat that organizes your tasks. Type or speak, and the assistant adds,
updates, completes and removes items on a list that syncs across your devices.

Next.js 16 · React 19 · TypeScript · Firebase Auth + Firestore · Gemini · Vosk

---

## How it works

The assistant does not return your task list. It calls **tools** — `add_task`,
`update_task`, `set_task_status`, `delete_task`, `list_tasks` — and the server
applies each call through a pure reducer with one invariant:

> A task is removed if and only if a `delete` operation named its id.

Everything else follows from that. `src/features/tasks/reducer.ts` is the only
code that changes a list, and it runs in both places: on the server against
Firestore for signed-in users, and in the browser against localStorage for
guests.

```
browser ──POST /api/chat──▶ verify ID token ──▶ rate limit ──▶ agent loop
                                                                  │
                                              tool calls ◀────────┤
                                                    │             │
                                            TaskSession           │
                                                    │             │
                                    applyOperations ─┘             │
                                                    │             │
   Firestore ◀── persist named documents only ◀─────┘             │
        │                                                          │
        └── onSnapshot ──▶ browser                    SSE text ◀───┘
```

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill it in
npm run dev
```

You need a Gemini API key ([AI Studio](https://aistudio.google.com/apikey)) and
a Firebase project with Google sign-in and Firestore enabled. `web_search` is
optional: without `SEARCH_API_KEY` the tool is not registered and the assistant
says it cannot look things up.

### Running against the emulators

```bash
npm run emulators   # Auth on 9099, Firestore on 8085, UI on 4000
```

With `FIRESTORE_EMULATOR_HOST=127.0.0.1:8085` set, the server uses application
default credentials and needs no service account.

## Testing

| Command                              | What it covers                                                  |
| ------------------------------------ | --------------------------------------------------------------- |
| `npm run test`                       | The reducer, the agent loop, the SSE codec, i18n, rate limiting |
| `npm run test:rules`                 | `firestore.rules` against the emulator                          |
| `npm run test:e2e`                   | The browser flows, with `/api/chat` stubbed                     |
| `npm run typecheck` / `npm run lint` | Types and static analysis, both zero-tolerance                  |

`npm run test:rules` starts the Firestore emulator, which is a Java process and
needs **JDK 21 or newer**:

```bash
sudo apt install openjdk-21-jdk-headless
```

## Deployment

Cloud Run, from the included Dockerfile:

```bash
gcloud run deploy task-helper-ai \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest \
  --set-secrets FIREBASE_SERVICE_ACCOUNT=firebase-service-account:latest
```

Publish the security rules separately:

```bash
npx firebase deploy --only firestore:rules
```

### Speech models

The Vosk models are served from a public bucket and are **not** in this
repository — they were 72MB of the git history until they were removed. Upload
them once and point `NEXT_PUBLIC_VOSK_BUCKET_URL` at the bucket:

```bash
gsutil cp model.tar.gz gs://<bucket>/en/model.tar.gz
gsutil cors set cors.json gs://<bucket>
```

`cors.json` needs `GET` from your origin; the browser fetches the archive
directly.

## Layout

```
src/
  app/[lang]/          pages, locale-prefixed and separately indexable
  app/api/chat/        the streaming endpoint and its wire protocol
  features/tasks/      operations, reducer, session, storage, UI
  features/chat/       transport, streaming hook, UI
  features/voice/      recording and wake word
  features/auth/       Firebase auth and incremental Google scopes
  lib/ai/              agent loop, prompt, tools
  lib/firebase/        client and admin SDK setup
  lib/vosk/            model loading and the recognition pipeline
  i18n/                typed dictionaries
firestore.rules        access control, covered by tests
```

Design notes and the reasoning behind the larger choices are in
[`docs/adr/`](docs/adr/).
