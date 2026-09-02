export const GOOGLE_TOKEN_KEY = "google_access_token";

export interface GoogleToken {
  accessToken: string;
  /** Epoch milliseconds. */
  expiresAt: number;
  scopes: string[];
}

/** Treat a token as expired slightly early so it is not used mid-flight. */
const EXPIRY_MARGIN_MS = 30_000;

export function isUsable(
  token: GoogleToken | null,
  required: string[],
  now = Date.now(),
): boolean {
  if (!token) return false;
  if (token.expiresAt - EXPIRY_MARGIN_MS <= now) return false;
  return required.every((scope) => token.scopes.includes(scope));
}

export function readToken(storage: Storage): GoogleToken | null {
  try {
    const raw = storage.getItem(GOOGLE_TOKEN_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as GoogleToken).accessToken !== "string" ||
      typeof (parsed as GoogleToken).expiresAt !== "number" ||
      !Array.isArray((parsed as GoogleToken).scopes)
    ) {
      return null;
    }
    return parsed as GoogleToken;
  } catch {
    return null;
  }
}

export function writeToken(storage: Storage, token: GoogleToken): void {
  try {
    storage.setItem(GOOGLE_TOKEN_KEY, JSON.stringify(token));
  } catch {
    // Storage unavailable; the in-memory copy still serves this session.
  }
}

export function clearToken(storage: Storage): void {
  try {
    storage.removeItem(GOOGLE_TOKEN_KEY);
  } catch {
    // See above.
  }
}
