"use client";
import { useAuth } from "../context/AuthContext";

// Accept label as prop for translation
export default function AuthButton({ label }: { label?: string }) {
  const { user, signInWithGoogle, logout, loading } = useAuth();

  if (loading) {
    return (
      <div className="w-24 h-8 bg-gray-200 rounded-full animate-pulse" />
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-2.5 animate-in fade-in duration-300 shrink-0">
        {user.photoURL && (
          <img 
            src={user.photoURL} 
            alt="User" 
            className="w-8 h-8 rounded-full border-2 border-gray-200 shrink-0 shadow-sm" 
          />
        )}
        <button 
          onClick={logout}
          className="text-xs cursor-pointer font-semibold text-gray-600 hover:text-red-600 transition-colors font-medium whitespace-nowrap px-3 py-1.5 rounded-lg hover:bg-red-50"
        >
          {label || "Sign Out"}
        </button>
      </div>
    );
  }

  return (
    <button 
      onClick={signInWithGoogle}
      className="text-xs bg-gradient-to-r from-blue-600 to-blue-700 text-white px-4 py-2 rounded-full hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg font-semibold animate-in fade-in duration-300 shrink-0 whitespace-nowrap active:scale-95"
    >
      {label || "Sign In"}
    </button>
  );
}