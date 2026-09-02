import { z } from "zod";

/**
 * Environment validation.
 *
 * Server variables are parsed lazily so that importing this module from a
 * client component never throws (the client bundle has no access to them).
 * Public variables are read through literal `process.env.NEXT_PUBLIC_*`
 * references, which is what lets Next inline them at build time.
 */

const serverSchema = z.object({
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
  FIREBASE_SERVICE_ACCOUNT: z.string().optional(),
  SEARCH_API_KEY: z.string().min(1).optional(),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cachedServerEnv: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (cachedServerEnv) return cachedServerEnv;

  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid server environment:\n${issues}`);
  }

  cachedServerEnv = parsed.data;
  return cachedServerEnv;
}

const publicSchema = z.object({
  firebase: z.object({
    apiKey: z.string().min(1),
    authDomain: z.string().min(1),
    projectId: z.string().min(1),
    storageBucket: z.string().min(1),
    messagingSenderId: z.string().min(1),
    appId: z.string().min(1),
  }),
  voskBucketUrl: z.url(),
});

export type PublicEnv = z.infer<typeof publicSchema>;

const rawPublicEnv = {
  firebase: {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  },
  voskBucketUrl: process.env.NEXT_PUBLIC_VOSK_BUCKET_URL,
};

let cachedPublicEnv: PublicEnv | undefined;

export function publicEnv(): PublicEnv {
  if (cachedPublicEnv) return cachedPublicEnv;

  const parsed = publicSchema.safeParse(rawPublicEnv);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map(
        (issue) =>
          `  - NEXT_PUBLIC_${issue.path.join("_").toUpperCase()}: ${issue.message}`,
      )
      .join("\n");
    throw new Error(`Invalid public environment:\n${issues}`);
  }

  cachedPublicEnv = parsed.data;
  return cachedPublicEnv;
}

/** True when the Firestore emulator is configured, i.e. local development or CI. */
export function isEmulated(): boolean {
  return Boolean(process.env.FIRESTORE_EMULATOR_HOST);
}
