import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import react from "ultracite/oxlint/react";
import tanstack from "ultracite/oxlint/tanstack";

// Gate G2. Lowering any rule here needs an accepted ADR (agent rule 15).

const effectSources = [
  "apps/server/**/*.ts",
  "packages/contract/**/*.ts",
  "packages/core/**/*.ts",
  "packages/db/**/*.ts",
  "packages/env/**/*.ts",
];

const noZod = {
  name: "zod",
  message:
    "Validation uses Effect Schema; zod may only remain as an AI SDK peer.",
};

const nodeBuiltins = [
  "node:*",
  "assert",
  "buffer",
  "child_process",
  "crypto",
  "events",
  "fs",
  "fs/promises",
  "http",
  "https",
  "net",
  "os",
  "path",
  "process",
  "stream",
  "url",
  "util",
  "worker_threads",
  "zlib",
];

export default defineConfig({
  extends: [core, react, tanstack],
  ignorePatterns: [...core.ignorePatterns, "apps/web/src/routeTree.gen.ts"],
  rules: {
    "no-restricted-imports": ["error", { paths: [noZod] }],
    // Configuration comes from Effect Config in packages/env, never process.env.
    "node/no-process-env": "error",
  },
  overrides: [
    {
      // The domain core and the contract run in the browser too.
      files: ["packages/core/**", "packages/contract/**"],
      rules: {
        "no-restricted-globals": [
          "error",
          "Buffer",
          "process",
          "require",
          "__dirname",
          "__filename",
        ],
        "no-restricted-imports": [
          "error",
          {
            paths: [noZod],
            patterns: [
              {
                group: nodeBuiltins,
                message:
                  "packages/core and packages/contract stay isomorphic: use Web APIs.",
              },
            ],
          },
        ],
      },
    },
    {
      files: ["packages/env/**"],
      rules: { "node/no-process-env": "off" },
    },
    {
      files: effectSources,
      rules: {
        // `Effect.gen(function* () {})` is the documented generator form; `Effect.fn` names it.
        "eslint/func-names": "off",
        // Tagged errors are declared beside the service that raises them.
        "eslint/max-classes-per-file": "off",
        // Effect service shapes are declared with method signatures.
        "typescript/method-signature-style": "off",
        // A schema and its type share one name (`const X = Schema...; type X = typeof X.Type`);
        // TypeScript itself rejects real redeclarations.
        "eslint/no-redeclare": "off",
        // `Schema.TaggedError<E>()(...)` builds a class; it throws nothing.
        "unicorn/throw-new-error": "off",
      },
    },
    {
      // Test integrity (agent rule 3): no test may be focused, skipped, left as todo, commented
      // out or defined conditionally, and titles stay unique because the ledger keys on them.
      // Style presets for tests are left out on purpose: ported tests keep their source titles
      // and assertions verbatim, and matcher rewrites could weaken them.
      files: ["**/*.test.ts", "**/*.test.tsx", "e2e/**/*.ts"],
      plugins: ["vitest"],
      rules: {
        "vitest/no-commented-out-tests": "error",
        // Off: these plugin defaults would force edits to tests ported verbatim.
        "vitest/no-conditional-expect": "off",
        "vitest/no-conditional-tests": "error",
        "vitest/no-disabled-tests": "error",
        "vitest/no-focused-tests": "error",
        "vitest/no-identical-title": "error",
        "vitest/no-standalone-expect": "error",
        "vitest/no-test-prefixes": "error",
        "vitest/require-mock-type-parameters": "off",
        "vitest/valid-describe-callback": "error",
        "vitest/valid-expect": "error",
        "vitest/valid-title": "off",
        "vitest/warn-todo": "error",
      },
    },
  ],
});
