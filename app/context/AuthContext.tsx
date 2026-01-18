"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { 
  User, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from "firebase/auth";
import { auth } from "../lib/firebase";

// 1. Update the Interface
interface AuthContextType {
  user: User | null;
  loading: boolean;
  googleAccessToken: string | null; // Added this property
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // 2. Add State for the token
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    // 3. Request Scope
    provider.addScope('https://www.googleapis.com/auth/tasks');
    
    try {
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      
      // 4. Capture Token
      if (credential?.accessToken) {
        setGoogleAccessToken(credential.accessToken);
      }
    } catch (error) {
      console.error("Login Failed", error);
    }
  };

  const logout = async () => {
    setGoogleAccessToken(null);
    await signOut(auth);
  };

  // 5. Expose token in value
  return (
    <AuthContext.Provider value={{ user, loading, googleAccessToken, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);