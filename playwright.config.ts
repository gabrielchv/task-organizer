import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

/**
 * The API is stubbed per test with `page.route`, so the suite exercises the
 * real client without spending Gemini quota or needing a Firebase project.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  ...(process.env.CI ? { workers: 1 } : {}),
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 13"] } },
  ],
  webServer: {
    // Build here rather than as a separate step: NEXT_PUBLIC_* values are
    // inlined at build time, so a build that did not see `env` below would
    // produce a bundle that throws on boot. The standalone server is what the
    // container runs, so that is what the browser tests drive.
    command: "npm run build && npm run start:local",
    timeout: 180_000,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    env: {
      NEXT_PUBLIC_FIREBASE_API_KEY: "test-api-key",
      NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "test.firebaseapp.com",
      NEXT_PUBLIC_FIREBASE_PROJECT_ID: "task-helper-test",
      NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "test.appspot.com",
      NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "000000000000",
      NEXT_PUBLIC_FIREBASE_APP_ID: "1:000000000000:web:test",
      NEXT_PUBLIC_VOSK_BUCKET_URL: "https://example.invalid/models",
      PORT: String(PORT),
    },
  },
});
