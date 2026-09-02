# 4. Speech models load on demand, through an AudioWorklet

Date: 2026-09-02
Status: Accepted

## Context

`useWakeWord` called `createModel` on mount, so every visitor downloaded a ~40MB
speech model whether or not they ever used voice, with no progress indication.
Both voice hooks then fed audio to Vosk through a `ScriptProcessorNode`, which
is deprecated and runs its callback on the main thread — recognition competed
with React for every frame.

## Decision

- The model downloads the first time the user enables the wake word, with
  progress, and is cached in Cache Storage for later visits.
- The Vosk runtime itself is a dynamic import, so it stays out of the bundle for
  users who never speak.
- Capture moves to an `AudioWorkletProcessor` that forwards fixed-size Float32
  frames. `acceptWaveformFloat` takes them directly, so no `AudioBuffer` is
  constructed per frame.
- The duplicated model config and audio plumbing in the two hooks moved into
  `src/lib/vosk`.

## Consequences

The worklet is a plain `.js` file under `public/`, because `addModule` needs a
URL — it is not covered by the TypeScript build. It is small and has no imports,
which is the trade being made.

Enabling the wake word now has a visible first-use cost. That is the honest
version of a cost every visitor was paying invisibly.
