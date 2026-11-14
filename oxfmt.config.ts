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
    "pnpm-lock.yaml",
  ],
});
