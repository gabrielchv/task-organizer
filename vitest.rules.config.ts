import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Security rules run against the Firestore emulator, so they need a Node
 * environment and a longer timeout than the unit suite.
 */
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/rules/**/*.test.ts"],
    testTimeout: 20_000,
    hookTimeout: 20_000,
    fileParallelism: false,
  },
});
