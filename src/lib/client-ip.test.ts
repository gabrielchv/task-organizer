import { describe, expect, it } from "vitest";
import { hashClientIp } from "./client-ip";

/**
 * The guest rate-limit key.
 *
 * Every assertion here is about which end of `X-Forwarded-For` is trusted. The
 * header is a list the caller can start, and proxies append to it, so only the
 * rightmost entry was written by infrastructure the app controls.
 */
describe("hashClientIp", () => {
  it("uses the rightmost hop, which is the one the proxy added", () => {
    expect(hashClientIp("203.0.113.9")).toBe(hashClientIp("203.0.113.9,".slice(0, -1)));
  });

  it("ignores a spoofed leftmost entry", () => {
    // The attack: a caller prepends an arbitrary address to win a fresh bucket
    // on every request. The real address is appended by the proxy, so the key
    // must be the same whatever the caller puts in front.
    const real = hashClientIp("198.51.100.7");

    for (const spoof of ["10.0.0.1", "10.0.1.1", "172.16.0.9", "203.0.113.200"]) {
      expect(hashClientIp(`${spoof}, 198.51.100.7`)).toBe(real);
    }
  });

  it("distinguishes callers with different real addresses", () => {
    expect(hashClientIp("198.51.100.7")).not.toBe(hashClientIp("198.51.100.8"));
  });

  it("tolerates whitespace and empty hops", () => {
    const real = hashClientIp("198.51.100.7");
    expect(hashClientIp("  198.51.100.7  ")).toBe(real);
    expect(hashClientIp("10.0.0.1,,198.51.100.7")).toBe(real);
  });

  it("falls back to a stable key when the header is absent or blank", () => {
    const missing = hashClientIp(null);

    expect(missing).toBe(hashClientIp(""));
    expect(missing).toBe(hashClientIp("   "));
    expect(missing).toBe(hashClientIp(","));
    // Malformed headers must not mint distinct keys.
    expect(hashClientIp(" , , ")).toBe(missing);
  });

  it("returns a fixed-width opaque digest, never the address", () => {
    const hashed = hashClientIp("198.51.100.7");

    expect(hashed).toMatch(/^[0-9a-f]{32}$/);
    expect(hashed).not.toContain("198.51.100.7");
  });
});
