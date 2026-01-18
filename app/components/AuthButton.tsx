"use client";
import { useAuth } from "../context/AuthContext";

export default function AuthButton() {
  const { user, loading, logout, signInWithGoogle} = useAuth();

  // 1. Loading Skeleton (Prevents jump)
  if (loading) {
    return (
      <div className="w-24 h-8 bg-gray-200 rounded-full animate-pulse" />
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-2 animate-in fade-in duration-300">
        {user.photoURL && (
          <img src={user.photoURL} alt="User" className="w-8 h-8 rounded-full border border-gray-200" />
        )}
        <button 
          onClick={logout}
          className="text-xs cursor-pointer text-gray-500 hover:text-red-500 transition-colors font-medium"
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <button 
      onClick={signInWithGoogle}
      className="text-xs bg-blue-600 text-white px-4 py-2 rounded-full hover:bg-blue-700 transition shadow-sm font-semibold animate-in fade-in duration-300"
    >
      Sign In
    </button>
  );
}