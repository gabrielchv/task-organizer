import { describe, expect, it } from "vitest";
import {
  GOOGLE_TOKEN_KEY,
  isUsable,
  readToken,
  writeToken,
  type GoogleToken,
} from "./google-token";

const NOW = 1_000_000;
const TASKS = "https://www.googleapis.com/auth/tasks";
const CALENDAR = "https://www.googleapis.com/auth/calendar.events";

function token(overrides: Partial<GoogleToken> = {}): GoogleToken {
  return {
    accessToken: "ya29.token",
    expiresAt: NOW + 3_600_000,
    scopes: [TASKS],
    ...overrides,
  };
}

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => void map.delete(key),
    setItem: (key, value) => void map.set(key, value),
  };
}

describe("isUsable", () => {
  it("rejects a missing token", () => {
    expect(isUsable(null, [TASKS], NOW)).toBe(false);
  });

  it("accepts a live token carrying the required scope", () => {
    expect(isUsable(token(), [TASKS], NOW)).toBe(true);
  });

  it("rejects a token missing a scope, so the app can ask for it incrementally", () => {
    expect(isUsable(token(), [TASKS, CALENDAR], NOW)).toBe(false);
  });

  it("rejects an expired token", () => {
    expect(isUsable(token({ expiresAt: NOW - 1 }), [TASKS], NOW)).toBe(false);
  });

  it("rejects a token about to expire rather than using it mid-request", () => {
    expect(isUsable(token({ expiresAt: NOW + 10_000 }), [TASKS], NOW)).toBe(false);
  });
});

describe("token storage", () => {
  it("round-trips a token", () => {
    const storage = memoryStorage();
    writeToken(storage, token());

    expect(readToken(storage)).toEqual(token());
  });

  it("returns null for a malformed entry", () => {
    expect(readToken(memoryStorage({ [GOOGLE_TOKEN_KEY]: "{}" }))).toBeNull();
    expect(readToken(memoryStorage({ [GOOGLE_TOKEN_KEY]: "nope" }))).toBeNull();
  });
});
