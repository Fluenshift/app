// Gate self-tests (#20): each gate must reject a deliberately broken change, and a control gate
// must still accept it, so the rejection comes from the intended gate.
//
//   node scripts/gate-selftest.ts [--root <baseline clones>]
//
// The cases run in a disposable worktree of HEAD beside this repository
// (../<name>-gate-selftest), which is reset between cases and removed at the end. The parity
// audit reads the baseline clones that `baselines.ts sync` maintains; --root points at another
// directory of clones. Exits 1 when a gate accepts its broken case or a control rejects it.

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { BaselineError, defaultRoot, repoRoot } from "./migration/baselines.ts";
import { evaluate } from "./migration/verdict-check.ts";

interface Outcome {
  readonly passed: boolean;
  readonly output: string;
}

type Check = (tree: string) => Outcome;

interface SelfTest {
  readonly gate: string;
  readonly name: string;
  readonly apply: (tree: string) => void;
  readonly rejectedBy: readonly (readonly [string, Check])[];
  readonly acceptedBy: readonly (readonly [string, Check])[];
}

function run(tree: string, command: string, args: readonly string[]): Outcome {
  const result = spawnSync(command, args, {
    cwd: tree,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return {
    passed: result.status === 0,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
}

const bin = (tree: string, name: string) =>
  path.join(tree, "node_modules", ".bin", name);

function write(tree: string, file: string, text: string): void {
  mkdirSync(path.dirname(path.join(tree, file)), { recursive: true });
  writeFileSync(path.join(tree, file), text);
}

// Replaces the first occurrence of `from`, and fails loudly when the fixture went stale.
function edit(tree: string, file: string, from: string, to: string): void {
  const full = path.join(tree, file);
  const text = readFileSync(full, "utf8");
  if (!text.includes(from))
    throw new BaselineError(
      `${file} no longer contains ${JSON.stringify(from)}`
    );
  writeFileSync(full, text.replace(from, to));
}

const lint =
  (file: string): Check =>
  (tree) =>
    run(tree, bin(tree, "oxlint"), ["--deny-warnings", file]);
const lintAll: Check = (tree) => run(tree, "pnpm", ["lint"]);
const types =
  (workspace: string): Check =>
  (tree) =>
    run(path.join(tree, workspace), bin(tree, "tsc"), [
      "--noEmit",
      "-p",
      "tsconfig.json",
    ]);
const tests =
  (workspace: string, file: string): Check =>
  (tree) =>
    run(path.join(tree, workspace), "pnpm", ["exec", "vitest", "run", file]);
const gates: Check = (tree) => run(tree, "node", ["scripts/check-gates.ts"]);

const TEST_FILE = "packages/core/src/selftest.test.ts";
const testFile = (body: string) =>
  `import { describe, expect, it } from "vitest";\n\ndescribe("self-test", () => {\n${body}\n});\n`;

// The ledger row and target the parity and red-green cases tamper with.
const LEDGER = "docs/migration/parity/evaluation-core.json";
const TARGET =
  '"packages/core/src/rubric-v1.test.ts::Rubric Version 1 > counts letter words while keeping internal apostrophes and hyphens"';

function selfTests(reports: string, baselines: string): SelfTest[] {
  const parityWithReports: Check = (tree) =>
    run(tree, "node", [
      "scripts/migration/parity-check.ts",
      "--reports",
      reports,
    ]);
  const audit: Check = (tree) =>
    run(tree, "node", [
      "scripts/migration/parity-audit.ts",
      "--root",
      baselines,
    ]);
  return [
    {
      gate: "G2",
      name: "a focused test",
      apply: (tree) =>
        write(
          tree,
          TEST_FILE,
          testFile(
            '  it.only("runs alone", () => {\n    expect(1).toBe(1);\n  });'
          )
        ),
      rejectedBy: [["lint", lint(TEST_FILE)]],
      acceptedBy: [["types", types("packages/core")]],
    },
    {
      gate: "G2",
      name: "a skipped test",
      apply: (tree) =>
        write(
          tree,
          TEST_FILE,
          testFile(
            '  it.skip("never runs", () => {\n    expect(1).toBe(1);\n  });'
          )
        ),
      rejectedBy: [["lint", lint(TEST_FILE)]],
      acceptedBy: [["types", types("packages/core")]],
    },
    {
      gate: "G2",
      name: "a todo test",
      apply: (tree) =>
        write(
          tree,
          TEST_FILE,
          'import { describe, it } from "vitest";\n\ndescribe("self-test", () => {\n  it.todo("is not written yet");\n});\n'
        ),
      rejectedBy: [["lint", lint(TEST_FILE)]],
      acceptedBy: [["types", types("packages/core")]],
    },
    {
      gate: "G2",
      name: "a zod import in packages/core",
      apply: (tree) =>
        write(
          tree,
          "packages/core/src/selftest.ts",
          'import { z } from "zod";\n\nexport const name = z.string();\n'
        ),
      rejectedBy: [["lint", lint("packages/core/src/selftest.ts")]],
      acceptedBy: [["tests", tests("packages/core", "src/utf8.test.ts")]],
    },
    {
      gate: "G1 and G2",
      name: "a Node built-in in packages/core",
      apply: (tree) =>
        write(
          tree,
          "packages/core/src/selftest.ts",
          'import { readFileSync } from "node:fs";\n\nexport const read = (file: string): string => readFileSync(file, "utf-8");\n'
        ),
      rejectedBy: [
        ["lint", lint("packages/core/src/selftest.ts")],
        ["types", types("packages/core")],
      ],
      acceptedBy: [["tests", tests("packages/core", "src/utf8.test.ts")]],
    },
    {
      gate: "G2",
      name: "process.env outside packages/env",
      apply: (tree) =>
        write(
          tree,
          "apps/server/src/selftest.ts",
          'export const port = process.env["SERVER_PORT"];\n'
        ),
      rejectedBy: [["lint", lint("apps/server/src/selftest.ts")]],
      acceptedBy: [["types", types("apps/server")]],
    },
    {
      gate: "G1",
      name: "a floating Effect",
      apply: (tree) =>
        write(
          tree,
          "packages/core/src/selftest.ts",
          'import { Effect } from "effect";\n\nexport const start = (): void => {\n  Effect.succeed(1);\n};\n'
        ),
      rejectedBy: [["types", types("packages/core")]],
      acceptedBy: [["lint", lint("packages/core/src/selftest.ts")]],
    },
    {
      gate: "G11",
      name: "a lowered oxlint severity",
      apply: (tree) =>
        edit(
          tree,
          "oxlint.config.ts",
          '"node/no-process-env": "error"',
          '"node/no-process-env": "warn"'
        ),
      rejectedBy: [["gate integrity", gates]],
      acceptedBy: [["lint", lintAll]],
    },
    {
      gate: "G11",
      name: "a lowered Effect diagnostic severity",
      apply: (tree) =>
        edit(
          tree,
          "packages/config/tsconfig.base.json",
          '"outdatedApi": "error"',
          '"outdatedApi": "warning"'
        ),
      rejectedBy: [["gate integrity", gates]],
      acceptedBy: [["types", types("packages/core")]],
    },
    {
      gate: "G9",
      name: "a ledger row pointing at a missing test",
      apply: (tree) =>
        edit(
          tree,
          LEDGER,
          TARGET,
          '"packages/core/src/rubric-v1.test.ts::Rubric Version 1 > no such test"'
        ),
      rejectedBy: [["parity check", parityWithReports]],
      acceptedBy: [["tests", tests("packages/core", "src/rubric-v1.test.ts")]],
    },
    {
      gate: "G9",
      name: "a port target with a changed title",
      apply: (tree) =>
        edit(
          tree,
          LEDGER,
          TARGET,
          '"packages/core/src/rubric-v1.test.ts::Rubric Version 1 > matches approved score anchors and band boundaries"'
        ),
      rejectedBy: [["parity check", parityWithReports]],
      acceptedBy: [["tests", tests("packages/core", "src/rubric-v1.test.ts")]],
    },
    {
      gate: "G10",
      name: "a weakened matcher",
      apply: (tree) =>
        edit(
          tree,
          "packages/core/src/protected-content.test.ts",
          ".toEqual(",
          ".toMatchObject("
        ),
      rejectedBy: [["parity audit", audit]],
      acceptedBy: [
        ["tests", tests("packages/core", "src/protected-content.test.ts")],
      ],
    },
  ];
}

// G8 needs history: one commit that adds a target whose test already passes.
function redGreenSelfTest(tree: string): {
  rejected: boolean;
  accepted: boolean;
} {
  const base = run(tree, "git", ["rev-parse", "HEAD"]).output.trim();
  write(
    tree,
    TEST_FILE,
    testFile(
      '  it("passes before any code", () => {\n    expect(1).toBe(1);\n  });'
    )
  );
  edit(
    tree,
    LEDGER,
    TARGET,
    `${TARGET},\n        "${TEST_FILE}::self-test > passes before any code"`
  );
  run(tree, "git", ["add", "-A"]);
  run(tree, "git", [
    "-c",
    "commit.gpgsign=false",
    "-c",
    "user.name=gate-selftest",
    "-c",
    "user.email=gate-selftest@example.invalid",
    "commit",
    "-qm",
    "test: add a target that already passes",
  ]);
  const verdict = run(tree, "node", [
    "scripts/migration/red-green.ts",
    "--base",
    base,
    "--head",
    "HEAD",
  ]);
  const control = tests("packages/core", "src/selftest.test.ts")(tree);
  run(tree, "git", ["reset", "-q", "--hard", base]);
  return {
    rejected: !verdict.passed && verdict.output.includes("before its code"),
    accepted: control.passed,
  };
}

const comment = (body: string, id: number) => ({
  id,
  body,
  createdAt: `2026-11-14T12:00:0${id}Z`,
  author: "owner",
  association: "MEMBER",
});
const verdictBody = (verifier: string, sha: string) =>
  `G12 PASS\nVerifier: ${verifier}\nHead: ${sha}\n`;

// G12 is computed from the PR and its comments, so it is checked on records, not on a tree.
function verdictSelfTests(): {
  name: string;
  rejected: boolean;
  accepted: boolean;
}[] {
  const head = "a".repeat(40);
  const older = "b".repeat(40);
  const pr = { headSha: head, labels: ["implementer:claude"] };
  const accepted = evaluate(pr, [comment(verdictBody("codex", head), 1)]).pass;
  return [
    {
      name: "a verdict for an older head",
      rejected: !evaluate(pr, [comment(verdictBody("codex", older), 1)]).pass,
      accepted,
    },
    {
      name: "a verdict from the implementing vendor",
      rejected: !evaluate(pr, [comment(verdictBody("claude", head), 1)]).pass,
      accepted,
    },
  ];
}

function main(argv: readonly string[]): number {
  const { values } = parseArgs({
    args: [...argv],
    options: { root: { type: "string" } },
  });
  const baselines =
    values.root === undefined ? defaultRoot : path.resolve(values.root);
  const tree = path.resolve(
    repoRoot,
    "..",
    `${path.basename(repoRoot)}-gate-selftest`
  );
  const reports = `${tree}-reports`;
  const reset = () => {
    run(tree, "git", ["reset", "-q", "--hard", "HEAD"]);
    run(tree, "git", ["clean", "-fdq"]);
  };
  if (existsSync(tree))
    run(repoRoot, "git", ["worktree", "remove", "--force", tree]);
  run(repoRoot, "git", ["worktree", "add", "--detach", tree, "HEAD"]);
  let failures = 0;
  const report = (gate: string, name: string, ok: boolean, detail: string) => {
    if (!ok) failures += 1;
    console.log(`${ok ? "ok" : "FAIL"} ${gate} ${name}: ${detail}`);
  };
  try {
    const install = run(tree, "pnpm", [
      "install",
      "--frozen-lockfile",
      "--prefer-offline",
    ]);
    if (!install.passed)
      throw new BaselineError(`pnpm install failed:\n${install.output}`);
    const testReports = run(tree, "node", [
      "scripts/migration/test-reports.ts",
      reports,
    ]);
    if (!testReports.passed)
      throw new BaselineError(
        `the test reports failed:\n${testReports.output}`
      );
    for (const test of selfTests(reports, baselines)) {
      reset();
      test.apply(tree);
      const rejections = test.rejectedBy.map(
        ([name, check]) => [name, !check(tree).passed] as const
      );
      const acceptances = test.acceptedBy.map(
        ([name, check]) => [name, check(tree).passed] as const
      );
      report(
        test.gate,
        test.name,
        [...rejections, ...acceptances].every(([, ok]) => ok),
        [
          ...rejections.map(
            ([name, ok]) => `${ok ? "rejected" : "ACCEPTED"} by ${name}`
          ),
          ...acceptances.map(
            ([name, ok]) => `${ok ? "accepted" : "REJECTED"} by ${name}`
          ),
        ].join(", ")
      );
    }
    reset();
    const redGreen = redGreenSelfTest(tree);
    report(
      "G8",
      "a first commit whose tests already pass",
      redGreen.rejected && redGreen.accepted,
      `${redGreen.rejected ? "rejected" : "ACCEPTED"} by red-green, ${redGreen.accepted ? "accepted" : "REJECTED"} by tests`
    );
    for (const test of verdictSelfTests())
      report(
        "G12",
        test.name,
        test.rejected && test.accepted,
        `${test.rejected ? "rejected" : "ACCEPTED"} by the verdict check, which ${test.accepted ? "accepts" : "REJECTS"} a proper verdict`
      );
  } finally {
    run(repoRoot, "git", ["worktree", "remove", "--force", tree]);
    rmSync(reports, { recursive: true, force: true });
  }
  console.log(
    failures === 0
      ? "gate self-tests: every gate rejects its broken case"
      : `gate self-tests: ${failures} failed`
  );
  return failures === 0 ? 0 : 1;
}

if (import.meta.main) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
