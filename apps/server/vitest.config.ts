import { defineConfig } from "vitest/config";

// The persistence tests open a PGlite database per case, and some cases open several at once.
export default defineConfig({
  test: {
    testTimeout: 60_000,
  },
});
