import { describe, expect, it } from "vitest";
import type { Firestore } from "firebase-admin/firestore";
import { consumeRateLimit, nextWindow, type WindowState } from "./rate-limit";

const POLICY = { limit: 3, windowMs: 60_000 };
const T0 = 1_000_000;

describe("nextWindow", () => {
  it("starts a window for a first-time caller", () => {
    const decision = nextWindow(undefined, T0, POLICY);

    expect(decision).toMatchObject({ allowed: true, remaining: 2 });
    expect(decision.state).toEqual({ windowStart: T0, count: 1 });
  });

  it("counts down within the window", () => {
    let state: WindowState | undefined;
    const remaining: number[] = [];

    for (let i = 0; i < 3; i += 1) {
      const decision = nextWindow(state, T0 + i * 1_000, POLICY);
      remaining.push(decision.remaining);
      state = decision.state;
    }

    expect(remaining).toEqual([2, 1, 0]);
  });

  it("blocks once the limit is reached and says how long to wait", () => {
    const state: WindowState = { windowStart: T0, count: 3 };

    const decision = nextWindow(state, T0 + 20_000, POLICY);

    expect(decision.allowed).toBe(false);
    expect(decision.retryAfterSeconds).toBe(40);
  });

  it("never reports a zero wait while blocked", () => {
    const state: WindowState = { windowStart: T0, count: 3 };

    const decision = nextWindow(state, T0 + 59_999, POLICY);

    expect(decision.retryAfterSeconds).toBe(1);
  });

  it("opens a fresh window once the old one elapsed", () => {
    const state: WindowState = { windowStart: T0, count: 3 };

    const decision = nextWindow(state, T0 + 60_000, POLICY);

    expect(decision.allowed).toBe(true);
    expect(decision.state).toEqual({ windowStart: T0 + 60_000, count: 1 });
  });

  it("does not consume the allowance when it blocks", () => {
    const state: WindowState = { windowStart: T0, count: 3 };

    const decision = nextWindow(state, T0 + 1_000, POLICY);

    expect(decision.state.count).toBe(3);
  });
});

describe("consumeRateLimit", () => {
  interface StoredDoc {
    windowStart: number;
    count: number;
    expiresAt?: Date;
  }

  /** A Firestore stand-in whose transaction reads and writes one in-memory doc. */
  function fakeDb(initial?: StoredDoc) {
    const store = new Map<string, StoredDoc>();
    if (initial) store.set("rateLimits/alice:m", initial);

    const db = {
      collection: (name: string) => ({
        doc: (id: string) => ({ path: `${name}/${id}` }),
      }),
      runTransaction: async <T>(
        handler: (transaction: {
          get: (ref: { path: string }) => Promise<{ data: () => StoredDoc | undefined }>;
          set: (ref: { path: string }, value: StoredDoc) => void;
        }) => Promise<T>,
      ): Promise<T> =>
        handler({
          get: async (ref) => ({ data: () => store.get(ref.path) }),
          set: (ref, value) => void store.set(ref.path, value),
        }),
    };

    return { db: db as unknown as Firestore, store };
  }

  it("opens a window for a caller that has not been seen", async () => {
    const { db, store } = fakeDb();

    const decision = await consumeRateLimit(db, "alice:m", POLICY, T0);

    expect(decision.allowed).toBe(true);
    expect(store.get("rateLimits/alice:m")).toMatchObject({ windowStart: T0, count: 1 });
  });

  it("continues an existing window rather than restarting it", async () => {
    const { db, store } = fakeDb({ windowStart: T0, count: 1 });

    await consumeRateLimit(db, "alice:m", POLICY, T0 + 5_000);

    expect(store.get("rateLimits/alice:m")).toMatchObject({ windowStart: T0, count: 2 });
  });

  it("blocks past the limit and does not write, so a blocked caller cannot extend it", async () => {
    const { db, store } = fakeDb({ windowStart: T0, count: 3 });

    const decision = await consumeRateLimit(db, "alice:m", POLICY, T0 + 5_000);

    expect(decision.allowed).toBe(false);
    expect(decision.retryAfterSeconds).toBe(55);
    expect(store.get("rateLimits/alice:m")).toMatchObject({ count: 3 });
  });

  it("ignores a corrupted counter document instead of failing the request", async () => {
    const { db } = fakeDb({ windowStart: Number.NaN, count: 0 });
    const corrupted = fakeDb();
    corrupted.store.set("rateLimits/alice:m", {
      windowStart: "soon",
    } as unknown as StoredDoc);

    await expect(consumeRateLimit(db, "alice:m", POLICY, T0)).resolves.toMatchObject({
      allowed: true,
    });
    await expect(
      consumeRateLimit(corrupted.db, "alice:m", POLICY, T0),
    ).resolves.toMatchObject({
      allowed: true,
    });
  });

  it("sets an expiry so counters do not accumulate forever", async () => {
    const { db, store } = fakeDb();

    await consumeRateLimit(db, "alice:m", POLICY, T0);

    expect(store.get("rateLimits/alice:m")?.expiresAt).toBeInstanceOf(Date);
  });
});
