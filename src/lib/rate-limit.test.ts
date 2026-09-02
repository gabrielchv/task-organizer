import { describe, expect, it } from "vitest";
import { nextWindow, type WindowState } from "./rate-limit";

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
