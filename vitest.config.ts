import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// Pure-logic tests only (game/* modules). No DOM environment needed.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/game/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
});
