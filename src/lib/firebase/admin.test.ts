import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `adminDb()` must initialise the app when it has not been initialised yet.
 *
 * The previous implementation was
 *
 *     getFirestore(getApp(APP_NAME) ?? adminApp())
 *
 * and the `??` could never fire: firebase-admin's `getApp(name)` *throws*
 * `app/no-app` for an unknown name rather than returning undefined. So on an
 * instance where `adminApp()` had not run yet — every cold Cloud Run instance,
 * and specifically every request from a signed-out caller, because
 * `authenticate()` returns before `adminAuth()` is reached — `adminDb()` threw
 * and the request became a 500.
 *
 * These tests drive the real modules with the Firebase SDK mocked at the
 * boundary, so they fail if the initialise-before-get ordering regresses.
 */

const state = {
  initialised: false,
  getAppCalls: 0,
  initializeAppCalls: 0,
};

vi.mock("firebase-admin/app", () => ({
  cert: (credentials: unknown) => ({ kind: "cert", credentials }),
  applicationDefault: () => ({ kind: "application-default" }),
  getApps: () => (state.initialised ? [{ name: "task-helper-admin" }] : []),
  initializeApp: (_options: unknown, name: string) => {
    state.initializeAppCalls += 1;
    state.initialised = true;
    return { name };
  },
  getApp: (name: string) => {
    state.getAppCalls += 1;
    if (!state.initialised) {
      // Mirrors the SDK: throws, does not return undefined.
      const error = new Error(`Firebase app named "${name}" does not exist.`);
      (error as Error & { code?: string }).code = "app/no-app";
      throw error;
    }
    return { name };
  },
}));

vi.mock("firebase-admin/auth", () => ({
  getAuth: (app: unknown) => ({ app, verifyIdToken: async () => ({ uid: "u1" }) }),
}));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: (app: unknown) => ({ app, kind: "firestore" }),
}));

vi.mock("@/lib/env", () => ({
  isEmulated: () => true,
  serverEnv: () => ({ FIREBASE_SERVICE_ACCOUNT: undefined }),
}));

describe("adminDb", () => {
  beforeEach(() => {
    state.initialised = false;
    state.getAppCalls = 0;
    state.initializeAppCalls = 0;
    vi.resetModules();
  });

  it("initialises the app on a cold instance instead of throwing", async () => {
    const { adminDb } = await import("./admin");

    expect(() => adminDb()).not.toThrow();
    expect(state.initializeAppCalls).toBe(1);
  });

  it("returns a Firestore handle bound to an app", async () => {
    const { adminDb } = await import("./admin");

    const db = adminDb() as unknown as { app: { name: string }; kind: string };
    expect(db.kind).toBe("firestore");
    expect(db.app.name).toBe("task-helper-admin");
  });

  it("does not re-initialise when the app already exists", async () => {
    const { adminDb } = await import("./admin");

    adminDb();
    adminDb();

    expect(state.initializeAppCalls).toBe(1);
  });

  it("works before any authenticated request has run", async () => {
    // The guest path: authenticate() returns before adminAuth() is reached, so
    // nothing else has had a chance to initialise the app.
    const { authenticate, adminDb } = await import("./admin");

    const guest = await authenticate(new Request("https://x.test/api/chat"));
    expect(guest).toBeNull();

    expect(() => adminDb()).not.toThrow();
  });
});
