import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Refuses every request to the real backend (preview and live share one database).
    setupFiles: [fileURLToPath(new URL("./tests/setup/block-live-database.ts", import.meta.url))],
    testTimeout: 30_000,
  },
});
