import { configDefaults, defineConfig } from "vitest/config";

// The Postgres suite needs a server, so it runs apart, through `pnpm test:postgres`.
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, "src/**/*.postgres.test.ts"],
  },
});
