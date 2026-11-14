import { defineConfig } from "vitest/config";

// The Database service against a Postgres server: DEPLOY_PROFILE=hosted and DATABASE_URL name
// it, as they do for the hosted profile.
export default defineConfig({
  test: {
    // The suite runs from this package, not from apps/server, where the default path points.
    env: { MIGRATIONS_PATH: "src/migrations" },
    include: ["src/**/*.postgres.test.ts"],
  },
});
