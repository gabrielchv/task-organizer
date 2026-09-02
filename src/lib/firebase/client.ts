"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { publicEnv } from "@/lib/env";

/**
 * The Firebase web config is public by design — it identifies the project, it
 * does not authorize anything. Access control lives in `firestore.rules`. It
 * moved out of the source file and into env vars so that staging and production
 * can point at different projects.
 */
function app() {
  return getApps().length > 0 ? getApp() : initializeApp(publicEnv().firebase);
}

export const firebaseAuth = () => getAuth(app());
export const firebaseDb = () => getFirestore(app());
