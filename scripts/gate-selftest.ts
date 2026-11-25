// Gate self-tests (#20): each gate must reject a deliberately broken change, and a control gate
// must still accept it, so the rejection comes from the intended gate.
//
//   node scripts/gate-selftest.ts
//
// The cases run in a disposable worktree of HEAD beside this repository
// (../<name>-gate-selftest), which is reset between cases and removed at the end. Exits 1 when a gate accepts its broken case or a control rejects it.

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { repoRoot, ScriptError } from "./repository.ts";

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
    throw new ScriptError(`${file} no longer contains ${JSON.stringify(from)}`);
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
const urlText: Check = (tree) =>
  run(tree, "node", ["scripts/check-url-text.ts"]);

const TEST_FILE = "packages/core/src/selftest.test.ts";
// Academy code, which the Phase 5f seam keeps from writing Evaluations.
const ACADEMY_FILE = "apps/server/src/academy/selftest.ts";
const PROTECTED_CONTENT_TEST = "src/protected-content.test.ts";
const RUBRIC_TEST = "src/rubric-v1.test.ts";
const UTF8_TEST = "src/utf8.test.ts";
const testFile = (body: string) =>
  `import { describe, expect, it } from "vitest";\n\ndescribe("self-test", () => {\n${body}\n});\n`;

// The tracked files the cases edit, run or compile against, beside the gate configurations. A
// change to one of them can make a case pass or fail for the wrong reason, so
// scripts/ci-changes.ts runs the self-tests again when one changes.
export const SELF_TEST_FIXTURES: readonly string[] = [
  // The unmapped tagged error case calls `makeEdge`.
  "apps/server/src/edge.ts",
  // The Academy cases write through, and import beside, the read-only Evaluation views.
  "packages/db/src/evaluation-views.ts",
  `packages/core/${PROTECTED_CONTENT_TEST}`,
  `packages/core/${RUBRIC_TEST}`,
  `packages/core/${UTF8_TEST}`,
];

function selfTests(): SelfTest[] {
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
      acceptedBy: [["tests", tests("packages/core", UTF8_TEST)]],
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
      acceptedBy: [["tests", tests("packages/core", UTF8_TEST)]],
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
      gate: "G1",
      name: "an unmapped tagged error at the edge",
      apply: (tree) =>
        write(
          tree,
          "apps/server/src/selftest.ts",
          [
            'import { Effect, Layer, ManagedRuntime, Schema } from "effect";',
            "",
            'import { makeEdge } from "./edge";',
            "",
            "class Unmapped extends Schema.TaggedError<",
            "  Unmapped,",
            "  { readonly brand: unique symbol }",
            '>()("Unmapped", {}) {}',
            "",
            "const edge = makeEdge(ManagedRuntime.make(Layer.empty));",
            "",
            "export const answer = (): Promise<Response> =>",
            "  edge(Effect.fail(new Unmapped()), {",
            "    errors: {},",
            '    success: () => Response.json({ status: "ok" }),',
            "  });",
            "",
          ].join("\n")
        ),
      rejectedBy: [["types", types("apps/server")]],
      acceptedBy: [["lint", lint("apps/server/src/selftest.ts")]],
    },
    {
      gate: "G2",
      name: "an Academy import of an Evaluation write service",
      apply: (tree) =>
        write(
          tree,
          ACADEMY_FILE,
          'import { persistEvaluation } from "../history/learning-history";\n\nexport const store = persistEvaluation;\n'
        ),
      rejectedBy: [["lint", lint(ACADEMY_FILE)]],
      acceptedBy: [["types", types("apps/server")]],
    },
    {
      gate: "G2",
      name: "an Academy import of a writable Evaluation table",
      apply: (tree) =>
        write(
          tree,
          ACADEMY_FILE,
          'import { evaluations } from "@grifando/db";\n\nexport const table = evaluations;\n'
        ),
      rejectedBy: [["lint", lint(ACADEMY_FILE)]],
      acceptedBy: [["types", types("apps/server")]],
    },
    {
      gate: "G2",
      name: "an Academy import of the Judge",
      apply: (tree) =>
        write(
          tree,
          ACADEMY_FILE,
          'import { evaluateWriting } from "../evaluation/writing-evaluation";\n\nexport const judge = evaluateWriting;\n'
        ),
      rejectedBy: [["lint", lint(ACADEMY_FILE)]],
      acceptedBy: [["types", types("apps/server")]],
    },
    {
      gate: "G2",
      name: "raw SQL in Academy code",
      apply: (tree) =>
        write(
          tree,
          ACADEMY_FILE,
          [
            'import type { DrizzleClient } from "@grifando/db";',
            'import { sql } from "drizzle-orm";',
            "",
            "export const erase = (client: DrizzleClient) =>",
            "  client.execute(sql`delete from evaluations`);",
            "",
          ].join("\n")
        ),
      rejectedBy: [["lint", lint(ACADEMY_FILE)]],
      acceptedBy: [["types", types("apps/server")]],
    },
    {
      gate: "G1",
      name: "an Academy write through a read-only Evaluation view",
      apply: (tree) =>
        write(
          tree,
          ACADEMY_FILE,
          [
            'import { evaluationsView } from "@grifando/db";',
            'import type { DrizzleClient } from "@grifando/db";',
            "",
            "export const erase = (client: DrizzleClient) =>",
            "  client.delete(evaluationsView);",
            "",
          ].join("\n")
        ),
      rejectedBy: [["types", types("apps/server")]],
      acceptedBy: [["lint", lint(ACADEMY_FILE)]],
    },
    {
      gate: "G7",
      name: "user text in a query string",
      apply: (tree) =>
        write(
          tree,
          "apps/server/src/selftest.ts",
          [
            'import { Hono } from "hono";',
            "",
            'export const search = new Hono().get("/api/search", (context) =>',
            '  context.text(context.req.query("writingSample") ?? "")',
            ");",
            "",
          ].join("\n")
        ),
      rejectedBy: [["url text", urlText]],
      acceptedBy: [
        ["types", types("apps/server")],
        ["lint", lint("apps/server/src/selftest.ts")],
      ],
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
  ];
}

function main(): number {
  const tree = path.resolve(
    repoRoot,
    "..",
    `${path.basename(repoRoot)}-gate-selftest`
  );
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
      throw new ScriptError(`pnpm install failed:\n${install.output}`);
    for (const test of selfTests()) {
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
  } finally {
    run(repoRoot, "git", ["worktree", "remove", "--force", tree]);
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
    process.exitCode = main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
