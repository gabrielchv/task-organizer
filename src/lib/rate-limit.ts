import type { Firestore } from "firebase-admin/firestore";

export interface RateLimitPolicy {
  /** Requests allowed per window. */
  limit: number;
  windowMs: number;
}

export interface WindowState {
  windowStart: number;
  count: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  state: WindowState;
}

/**
 * Fixed-window counter, as a pure function so the arithmetic can be tested
 * without a database.
 */
export function nextWindow(
  state: WindowState | undefined,
  now: number,
  { limit, windowMs }: RateLimitPolicy,
): RateLimitDecision {
  const expired = state === undefined || now - state.windowStart >= windowMs;
  const current: WindowState = expired ? { windowStart: now, count: 0 } : state;

  if (current.count >= limit) {
    const elapsed = now - current.windowStart;
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((windowMs - elapsed) / 1000)),
      state: current,
    };
  }

  const updated: WindowState = { windowStart: current.windowStart, count: current.count + 1 };
  return {
    allowed: true,
    remaining: limit - updated.count,
    retryAfterSeconds: 0,
    state: updated,
  };
}

/**
 * Counts against a Firestore document inside a transaction.
 *
 * In-memory counters would be per-instance, and Cloud Run runs many instances,
 * so the limit has to live somewhere shared. The document is small and written
 * once per request, which is well inside the free tier for this workload.
 */
export async function consumeRateLimit(
  db: Firestore,
  key: string,
  policy: RateLimitPolicy,
  now = Date.now(),
): Promise<RateLimitDecision> {
  const ref = db.collection("rateLimits").doc(key);

  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.data();
    const state: WindowState | undefined =
      typeof data?.["windowStart"] === "number" && typeof data["count"] === "number"
        ? { windowStart: data["windowStart"], count: data["count"] }
        : undefined;

    const decision = nextWindow(state, now, policy);
    if (decision.allowed) {
      transaction.set(ref, { ...decision.state, expiresAt: new Date(now + policy.windowMs * 2) });
    }
    return decision;
  });
}

/** Signed-in callers get a higher allowance than anonymous ones. */
export const POLICIES = {
  user: { limit: 30, windowMs: 60_000 },
  guest: { limit: 8, windowMs: 60_000 },
  userDaily: { limit: 500, windowMs: 24 * 60 * 60_000 },
  guestDaily: { limit: 40, windowMs: 24 * 60 * 60_000 },
} as const satisfies Record<string, RateLimitPolicy>;
