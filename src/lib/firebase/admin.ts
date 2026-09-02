import { cert, getApp, getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { isEmulated, serverEnv } from "@/lib/env";

const APP_NAME = "task-helper-admin";

function adminApp() {
  const existing = getApps().find((app) => app.name === APP_NAME);
  if (existing) return existing;

  const { FIREBASE_SERVICE_ACCOUNT } = serverEnv();

  // Against the emulators there is no service account to load, and the SDK
  // accepts unauthenticated calls once FIRESTORE_EMULATOR_HOST is set.
  if (!FIREBASE_SERVICE_ACCOUNT) {
    if (!isEmulated()) {
      throw new Error(
        "FIREBASE_SERVICE_ACCOUNT is required outside the emulators; " +
          "without it the server cannot verify ID tokens.",
      );
    }
    return initializeApp(
      { credential: applicationDefault(), projectId: process.env.GCLOUD_PROJECT ?? "task-helper-test" },
      APP_NAME,
    );
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(FIREBASE_SERVICE_ACCOUNT) as Record<string, unknown>;
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT is not valid JSON");
  }

  return initializeApp({ credential: cert(parsed) }, APP_NAME);
}

export function adminAuth() {
  return getAuth(adminApp());
}

export function adminDb() {
  return getFirestore(getApp(APP_NAME) ?? adminApp());
}

export interface AuthenticatedUser {
  uid: string;
}

/**
 * Resolves the caller from an `Authorization: Bearer <Firebase ID token>`
 * header, or `null` for an anonymous caller.
 *
 * The previous API had no notion of a caller at all: `/api/process` accepted
 * any request from anyone and spent the project's Gemini quota on it.
 */
export async function authenticate(request: Request): Promise<AuthenticatedUser | null> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;

  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;

  try {
    const decoded = await adminAuth().verifyIdToken(token);
    return { uid: decoded.uid };
  } catch {
    // An invalid token is treated as anonymous rather than as an error: the
    // caller still gets a reply, just under the stricter guest limits.
    return null;
  }
}
