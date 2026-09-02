# Contributing

## Before you push

```bash
npm run typecheck && npm run lint && npm run format:check
npm run test
npm run test:rules   # needs JDK 21+
npm run build && npm run test:e2e
```

CI runs all of these. `lint` fails on warnings, `any`, `@ts-expect-error` and
stray `console.log`.

## Where things belong

- **Changing what the assistant can do** — add a tool in `src/lib/ai/tools/`.
  Do not describe new behaviour in the prompt without a tool behind it.
- **Changing what a change to a task means** — `src/features/tasks/operations.ts`
  and `reducer.ts`. Both are pure and test-first; add the failing test before
  the behaviour.
- **Changing the interface** — update the dictionary in `src/i18n/dictionaries/`.
  Both locales are typed against English, so a missing key will not compile. If
  you move a button, update `help` in the same file: that is what the assistant
  reads through `get_app_help`.
- **Changing the request or response shape** — `src/app/api/chat/protocol.ts`
  holds both ends of the wire format.

## Rules that are not negotiable

1. `applyOperations` is the only code that changes a task list. Both the server
   and the browser go through it.
2. A task is deleted only by an explicit `delete` operation naming its id.
3. The uid a write targets comes from the verified ID token, never from a
   request body.
4. Anything read from a client — localStorage, a request body, a tool argument
   from the model — is validated before use.

## Commits

Conventional prefixes (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`).
Explain why the change is needed, not just what changed.
