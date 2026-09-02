"use client";

import Image from "next/image";
import { useAuth } from "./AuthProvider";

export function AuthButton({
  signInLabel,
  signOutLabel,
}: {
  signInLabel: string;
  signOutLabel: string;
}) {
  const { user, loading, signIn, signOutUser } = useAuth();

  if (loading) {
    return (
      <div className="h-8 w-24 animate-pulse rounded-full bg-gray-200" aria-hidden />
    );
  }

  if (user) {
    return (
      <div className="flex shrink-0 items-center gap-2.5">
        {user.photoURL && (
          <Image
            src={user.photoURL}
            alt=""
            width={32}
            height={32}
            className="shrink-0 rounded-full border-2 border-gray-200 shadow-sm"
            unoptimized
          />
        )}
        <button
          type="button"
          onClick={() => void signOutUser()}
          className="cursor-pointer whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:bg-red-50 hover:text-red-600"
        >
          {signOutLabel}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void signIn()}
      className="shrink-0 cursor-pointer whitespace-nowrap rounded-full bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-md transition-all hover:from-blue-700 hover:to-blue-800 hover:shadow-lg active:scale-95"
    >
      {signInLabel}
    </button>
  );
}
