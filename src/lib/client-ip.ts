import { createHash } from "node:crypto";

/**
 * The guest rate-limit key: a hash of the caller's address.
 *
 * The address is taken from the **rightmost** `X-Forwarded-For` entry, not the
 * leftmost. Cloud Run's front end appends the address it saw to whatever the
 * client sent, so the leftmost value is entirely attacker-controlled: sending
 * `X-Forwarded-For: 10.0.<i>.1` produced a fresh rate-limit bucket per request
 * and voided both guest policies (8/min, 40/day) along with the Gemini spend
 * they exist to bound. The rightmost entry is the one the trusted proxy added.
 *
 * This assumes exactly one trusted proxy in front of the app, which is the
 * documented Cloud Run deployment. Behind a chain of proxies that number has to
 * grow with the chain, or the key is once again a value the caller chose.
 *
 * Hashed so raw addresses are never written to Firestore or the logs.
 */
export function hashClientIp(forwardedFor: string | null): string {
  const hops = (forwardedFor ?? "")
    .split(",")
    .map((hop) => hop.trim())
    .filter(Boolean);
  const ip = hops.at(-1) ?? "unknown";
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}
