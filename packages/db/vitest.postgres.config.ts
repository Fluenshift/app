import { defineConfig } from "vitest/config";

// The Database service against a Postgres server: DEPLOY_PROFILE=hosted and DATABASE_URL name
// it, as they do for the hosted profile.
export default defineConfig({
  test: {
    include: ["src/**/*.postgres.test.ts"],
  },
});
