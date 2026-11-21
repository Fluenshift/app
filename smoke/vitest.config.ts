import { defineConfig } from "vitest/config";

// The Docker smoke builds the image and starts it in both profiles, so a step takes minutes.
export default defineConfig({
  test: {
    hookTimeout: 5 * 60_000,
    testTimeout: 15 * 60_000,
  },
});
