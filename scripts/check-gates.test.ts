import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  compare,
  compareLines,
  compareLint,
  compareScripts,
  compareSuppressions,
  compareTypeScript,
  compareWorkflow,
  countSuppressions,
  effectiveOptions,
  gateScripts,
  lintSnapshot,
  REFERENCE_TSCONFIG,
  ruleSetting,
  significantLines,
  typeScriptSnapshot,
  workflowSnapshot,
} from "./check-gates.ts";
import type { Snapshot } from "./check-gates.ts";

const lint = (overrides: Record<string, unknown> = {}) =>
  lintSnapshot({
    plugins: ["unicorn", "typescript"],
    categories: {},
    rules: {
      eqeqeq: "deny",
      "no-console": "allow",
      "no-restricted-imports": [
        "deny",
        { paths: [{ name: "zod", message: "Use Effect Schema." }] },
      ],
    },
    overrides: [
      {
        files: ["**/*.test.ts"],
        plugins: ["vitest"],
        rules: { "vitest/no-focused-tests": "deny", eqeqeq: "allow" },
      },
    ],
    ignorePatterns: ["dist/**"],
    ...overrides,
  });

describe("ruleSetting", () => {
  it("reads printed severities and options", () => {
    assert.deepEqual(ruleSetting("deny"), { severity: 2, options: "[]" });
    assert.deepEqual(ruleSetting("warn"), { severity: 1, options: "[]" });
    assert.deepEqual(ruleSetting(undefined), { severity: 0, options: "[]" });
    assert.equal(
      ruleSetting(["deny", { b: 1, a: 2 }]).options,
      ruleSetting(["error", { a: 2, b: 1 }]).options
    );
  });
});

describe("compareLint", () => {
  it("passes an equal or stricter configuration", () => {
    const stricter = lint({
      plugins: ["unicorn", "typescript", "react"],
      rules: {
        eqeqeq: "deny",
        "no-console": "deny",
        "no-restricted-imports": [
          "deny",
          { paths: [{ message: "Use Effect Schema.", name: "zod" }] },
        ],
      },
      ignorePatterns: [],
    });

    assert.deepEqual(compareLint("lint", lint(), lint()), []);
    assert.deepEqual(compareLint("lint", lint(), stricter), []);
  });

  it("fails a weaker rule, changed options, a dropped plugin and a new ignore pattern", () => {
    const weaker = lint({
      plugins: ["unicorn"],
      rules: {
        eqeqeq: "warn",
        "no-console": "allow",
        "no-restricted-imports": ["deny", { paths: [] }],
      },
      ignorePatterns: ["dist/**", "src/**"],
    });

    assert.deepEqual(compareLint("lint", lint(), weaker), [
      "lint: rule eqeqeq is weaker than the baseline",
      "lint: rule no-restricted-imports changed its options",
      "lint: plugin typescript was dropped",
      "lint: ignore pattern src/** was added",
    ]);
  });

  it("fails an override that relaxes a rule or drops one of its rules", () => {
    const relaxed = lint({
      overrides: [
        {
          files: ["**/*.test.ts"],
          plugins: [],
          rules: { "vitest/no-focused-tests": "allow", eqeqeq: "allow" },
        },
        { files: ["src/**"], plugins: [], rules: { eqeqeq: "allow" } },
      ],
    });
    const dropped = lint({
      overrides: [{ files: ["**/*.test.ts"], plugins: ["vitest"], rules: {} }],
    });
    const removed = lint({ overrides: [] });

    assert.deepEqual(compareLint("lint", lint(), relaxed), [
      'lint override ["**/*.test.ts"]: plugin vitest left the override',
      'lint override ["**/*.test.ts"]: rule vitest/no-focused-tests is weaker than the baseline',
      'lint override ["src/**"]: a new override relaxes rule eqeqeq',
    ]);
    assert.deepEqual(compareLint("lint", lint(), dropped), [
      'lint override ["**/*.test.ts"]: rule vitest/no-focused-tests left the override',
    ]);
    assert.deepEqual(compareLint("lint", lint(), removed), [
      'lint: the override for ["**/*.test.ts"] was removed with rule vitest/no-focused-tests',
    ]);
  });
});

const configs: Record<string, unknown> = {
  "/repo/base.json": {
    compilerOptions: {
      strict: true,
      noUnusedLocals: true,
      skipLibCheck: true,
      plugins: [
        {
          name: "@effect/language-service",
          diagnosticSeverity: { outdatedApi: "error", effectFnIife: "warning" },
          allowedUnstableApis: ["@effect/vitest"],
        },
      ],
    },
  },
  "/repo/pkg/tsconfig.json": {
    extends: "../base.json",
    compilerOptions: { noUnusedLocals: false },
  },
};
const readConfig = (file: string) => configs[file];
const resolveExtends = (from: string, specifier: string) =>
  `${from.slice(0, from.lastIndexOf("/"))}/${specifier}`.replace(
    "/pkg/../",
    "/"
  );
const tsSnapshot = (file: string) =>
  typeScriptSnapshot(effectiveOptions(file, readConfig, resolveExtends));

describe("compareTypeScript", () => {
  it("follows extends and the strict family", () => {
    const base = tsSnapshot("/repo/base.json");

    assert.equal(base.options["noImplicitAny"], true);
    assert.equal(base.options["exactOptionalPropertyTypes"], null);
    assert.deepEqual(base.effect?.allowedUnstableApis, ["@effect/vitest"]);
    assert.equal(
      tsSnapshot("/repo/pkg/tsconfig.json").options["noUnusedLocals"],
      false
    );
  });

  it("passes an equal or stricter configuration", () => {
    const base = tsSnapshot("/repo/base.json");
    const stricter = typeScriptSnapshot({
      strict: true,
      noUnusedLocals: true,
      exactOptionalPropertyTypes: true,
      skipLibCheck: false,
      plugins: [
        {
          name: "@effect/language-service",
          diagnosticSeverity: { outdatedApi: "error", effectFnIife: "error" },
          allowedUnstableApis: [],
        },
      ],
    });

    assert.deepEqual(compareTypeScript("base", base, base), []);
    assert.deepEqual(compareTypeScript("base", base, stricter), []);
  });

  it("fails weaker options, severities and newly allowed unstable APIs", () => {
    const base = tsSnapshot("/repo/base.json");
    const weaker = typeScriptSnapshot({
      strict: true,
      strictNullChecks: false,
      plugins: [
        {
          name: "@effect/language-service",
          diagnosticSeverity: { outdatedApi: "warning" },
          allowedUnstableApis: ["@effect/vitest", "effect/unstable/http"],
        },
      ],
    });

    assert.deepEqual(compareTypeScript("pkg", base, weaker), [
      "pkg: compiler option noUnusedLocals is weaker",
      "pkg: compiler option strictNullChecks is weaker",
      "pkg: Effect diagnostic outdatedApi is weaker",
      "pkg: Effect diagnostic effectFnIife is weaker",
      "pkg: unstable Effect API effect/unstable/http was allowed",
    ]);
    assert.deepEqual(
      compareTypeScript(
        "pkg",
        base,
        typeScriptSnapshot({ strict: true, noUnusedLocals: true })
      ),
      ["pkg: the @effect/language-service plugin is gone"]
    );
  });
});

describe("compareScripts", () => {
  it("keeps every gate script verbatim", () => {
    const scripts = gateScripts({
      scripts: {
        lint: "oxlint --deny-warnings",
        dev: "vite",
        test: "vitest run",
      },
    });

    assert.deepEqual(scripts, {
      lint: "oxlint --deny-warnings",
      test: "vitest run",
    });
    assert.deepEqual(compareScripts("package.json", scripts, scripts), []);
    assert.deepEqual(
      compareScripts("package.json", scripts, { lint: "oxlint" }),
      [
        "package.json: script lint changed or was removed",
        "package.json: script test changed or was removed",
      ]
    );
  });
});

const workflow = `name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  verify:
    runs-on: ubuntu-24.04
    steps:
      - name: Lint
        run: pnpm lint
      - name: Scan
        run: >-
          docker run --rm image
          --redact
`;

describe("compareWorkflow", () => {
  it("reads triggers, run commands and conditions", () => {
    assert.deepEqual(workflowSnapshot(workflow), {
      triggers: ["branches: [main]", "pull_request:", "push:"],
      run: ["docker run --rm image --redact", "pnpm lint"],
      conditions: [],
    });
  });

  it("fails a removed trigger, a changed command and a new condition", () => {
    const weaker = workflow
      .replace("  pull_request:\n", "")
      .replace("run: pnpm lint", "run: pnpm lint || true")
      .replace("    runs-on", "    continue-on-error: true\n    runs-on");

    assert.deepEqual(
      compareWorkflow(
        "ci.yml",
        workflowSnapshot(workflow),
        workflowSnapshot(weaker)
      ),
      [
        'ci.yml: trigger "pull_request:" was removed',
        'ci.yml: run "pnpm lint" was removed or changed',
        'ci.yml: "continue-on-error: true" was added',
      ]
    );
  });
});

describe("compareLines", () => {
  it("fails any removed or added line, ignoring comments and blank lines", () => {
    const config =
      "export default {\n  // retries stay off\n  forbidOnly: true,\n};\n";

    assert.deepEqual(significantLines(config), [
      "export default {",
      "forbidOnly: true,",
      "};",
    ]);
    assert.deepEqual(
      compareLines(
        "playwright.config.ts",
        significantLines(config),
        significantLines(`${config}\n// another comment\n`)
      ),
      []
    );
    assert.deepEqual(
      compareLines(
        "playwright.config.ts",
        significantLines(config),
        significantLines(config.replace("true", "false"))
      ),
      [
        'playwright.config.ts: line "forbidOnly: true," was removed or changed',
        'playwright.config.ts: line "forbidOnly: false," was added',
      ]
    );
  });
});

// Spelled in pieces, so this file holds no suppression comment of its own.
const LINT_DISABLE = `// oxlint${"-disable"}-next-line no-console`;
const TS_EXPECT_ERROR = `/* @ts${"-expect-error"} */`;

describe("compareSuppressions", () => {
  it("counts suppression comments per kind", () => {
    assert.deepEqual(
      countSuppressions(
        `${LINT_DISABLE}\nconsole.log(1);\n${TS_EXPECT_ERROR}\n${LINT_DISABLE}\n`
      ),
      { "lint-disable": 2, "ts-expect-error": 1 }
    );
    assert.deepEqual(
      countSuppressions("// mentions oxlint-disable in prose\n"),
      {}
    );
  });

  it("fails a file that gains a suppression", () => {
    const baseline = { "a.ts": { "lint-disable": 1 } };

    assert.deepEqual(
      compareSuppressions(baseline, { "a.ts": { "lint-disable": 1 } }),
      []
    );
    assert.deepEqual(compareSuppressions(baseline, {}), []);
    assert.deepEqual(
      compareSuppressions(baseline, {
        "a.ts": { "lint-disable": 2 },
        "b.ts": { "ts-expect-error": 1 },
      }),
      [
        "a.ts: lint-disable suppressions rose to 2",
        "b.ts: ts-expect-error suppressions rose to 1",
      ]
    );
  });
});

const snapshot = (overrides: Partial<Snapshot> = {}): Snapshot => ({
  lint: { "oxlint.config.ts": lint() },
  typescript: { [REFERENCE_TSCONFIG]: tsSnapshot("/repo/base.json") },
  scripts: { "package.json": { lint: "oxlint --deny-warnings" } },
  workflows: { "ci.yml": workflowSnapshot(workflow) },
  lines: { ".husky/pre-commit": ["pnpm exec oxlint"] },
  suppressions: {},
  ...overrides,
});

describe("compare", () => {
  it("passes the tree it recorded", () => {
    assert.deepEqual(compare(snapshot(), snapshot()), []);
  });

  it("fails a missing gate file, a lax new tsconfig and an unrecorded test configuration", () => {
    const current = snapshot({
      lint: {},
      typescript: {
        [REFERENCE_TSCONFIG]: tsSnapshot("/repo/base.json"),
        "packages/new/tsconfig.json": tsSnapshot("/repo/pkg/tsconfig.json"),
      },
      lines: {
        ".husky/pre-commit": ["pnpm exec oxlint"],
        "packages/new/vitest.config.ts": ["export default {};"],
      },
    });

    assert.deepEqual(compare(snapshot(), current), [
      "oxlint.config.ts: lint configuration is missing",
      "packages/new/tsconfig.json: compiler option noUnusedLocals is weaker",
      "packages/new/vitest.config.ts: a new configuration the baseline does not hold",
    ]);
  });
});
