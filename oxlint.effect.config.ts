import { recommended } from "@effect/tsgo/oxlint-presets";
import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";

// Type-aware Effect rules for the Effect workspaces (pnpm lint:effect). Kept apart from
// oxlint.config.ts because `options.typeAware` switches the whole config, and the React
// workspaces hold no Effect code.
export default defineConfig({
  ignorePatterns: [...core.ignorePatterns],
  options: recommended.options,
  plugins: recommended.plugins,
  rules: recommended.rules,
});
