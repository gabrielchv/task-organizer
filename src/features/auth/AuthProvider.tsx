"use client";

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { firebaseAuth } from "@/lib/firebase/client";
import {
  clearToken,
  isUsable,
  readToken,
  writeToken,
  type GoogleToken,
} from "./google-token";

export const GOOGLE_TASKS_SCOPE = "https://www.googleapis.com/auth/tasks";
export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOutUser: () => Promise<void>;
  /**
   * Obtains an access token carrying `scopes`, prompting only when the current
   * token does not already cover them.
   */
  authorizeGoogle: (scopes: string[]) => Promise<string | null>;
  /** The ID token to send to our own API, or null when signed out. */
  getIdToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const tokenRef = useRef<GoogleToken | null>(null);

  useEffect(() => {
    tokenRef.current = readToken(sessionStorage);
    return onAuthStateChanged(firebaseAuth(), (current) => {
      setUser(current);
      setLoading(false);
    });
  }, []);

  const signIn = useCallback(async () => {
    // Deliberately no Tasks or Calendar scopes here. The previous version asked
    // every user for write access to their Google Tasks and Calendar just to
    // sign in, even if they never exported anything.
    await signInWithPopup(firebaseAuth(), new GoogleAuthProvider());
  }, []);

  const signOutUser = useCallback(async () => {
    tokenRef.current = null;
    clearToken(sessionStorage);
    await signOut(firebaseAuth());
  }, []);

  const authorizeGoogle = useCallback(async (scopes: string[]) => {
    if (isUsable(tokenRef.current, scopes)) return tokenRef.current?.accessToken ?? null;

    const provider = new GoogleAuthProvider();
    for (const scope of scopes) provider.addScope(scope);

    const result = await signInWithPopup(firebaseAuth(), provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) return null;

    const token: GoogleToken = {
      accessToken: credential.accessToken,
      // Google access tokens last an hour; the exact lifetime is not returned.
      expiresAt: Date.now() + 55 * 60_000,
      scopes,
    };
    tokenRef.current = token;
    writeToken(sessionStorage, token);
    return token.accessToken;
  }, []);

  const getIdToken = useCallback(async () => {
    const current = firebaseAuth().currentUser;
    return current ? current.getIdToken() : null;
  }, []);

  const value = useMemo(
    () => ({ user, loading, signIn, signOutUser, authorizeGoogle, getIdToken }),
    [user, loading, signIn, signOutUser, authorizeGoogle, getIdToken],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
