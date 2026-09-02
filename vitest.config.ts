import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/features/**", "src/lib/**", "src/app/api/**", "src/i18n/**"],
      exclude: ["**/*.test.*", "src/lib/firebase/client.ts", "src/lib/firebase/admin.ts"],
    },
  },
});
