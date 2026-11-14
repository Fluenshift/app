import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  ignorePatterns: [
    ...ultracite.ignorePatterns,
    "AGENTS.md",
    "CLAUDE.md",
    "CONTEXT.md",
    "apps/web/src/routeTree.gen.ts",
    "docs/**",
    "migration/**",
    // Written by drizzle-kit (`pnpm db:generate`), never by hand.
    "packages/db/src/migrations/**",
    "pnpm-lock.yaml",
  ],
});
