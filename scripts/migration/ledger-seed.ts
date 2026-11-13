// Seeds the parity ledger (Phase 0 steps 5 and 6) from the inventory: one ledger row per
// inventory row, with its slice, test class, disposition and blocking decision. The rules
// below are the classification; a verifier reviews them rather than each row.
//
//   node scripts/migration/ledger-seed.ts [--force]
//
// Writes docs/migration/parity/<slice>.json. Refuses to overwrite existing ledger files
// unless --force is given, because units add targets to the ledger after seeding.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { BaselineError, repoRoot } from "./baselines.ts";
import { naturalCompare } from "./inventory.ts";

type Lane = "evaluation" | "academy" | "platform";
type TestClass = "A" | "B" | "C";
type Disposition =
  | "port"
  | "port-changed"
  | "superseded"
  | "drop"
  | "informative"
  | "pending-decision";

interface InventoryRow {
  readonly id: string;
  readonly kind: string;
  readonly source: string;
  readonly title: string;
  readonly baseline?: string;
  readonly files?: readonly string[];
}

interface Rule {
  readonly match: (row: InventoryRow) => boolean;
  readonly slice: string;
  readonly testClass?: TestClass;
  readonly disposition: Disposition;
  readonly decision?: string;
}

interface LedgerRow {
  readonly id: string;
  readonly source: string;
  readonly class: TestClass | null;
  readonly slice: string;
  readonly disposition: Disposition;
  readonly decision: string | null;
  readonly targets: readonly string[];
}

const SLICES: Readonly<Record<string, Lane>> = {
  "evaluation-core": "evaluation",
  "evaluation-persistence": "evaluation",
  "evaluation-judge": "evaluation",
  "evaluation-http": "evaluation",
  "evaluation-web": "evaluation",
  "evaluation-e2e": "evaluation",
  "evaluation-policy": "evaluation",
  platform: "platform",
  "academy-core": "academy",
  "academy-trainer": "academy",
  "academy-persistence": "academy",
  "academy-http": "academy",
  "academy-web": "academy",
  "academy-spec": "academy",
  hosted: "platform",
};

// Open decisions, named by the ADR or issue that settles them (docs/migration/README.md).
const D = {
  protocol: "adr:0001",
  scores: "adr:0002",
  profiles: "adr:0003",
  writingAnalysis: "adr:0004",
  caps: "adr:0006",
  urlSelection: "adr:0008",
  design: "adr:0009",
  interview: "adr:0010",
  cleanup: "adr:0011",
  providers: "adr:0012",
  analytics: "adr:0013",
  practice: "adr:0016",
  persistence: "adr:0017",
  redClock: "issue:1",
} as const;

const test = (row: InventoryRow) => row.kind === "test";
const inFiles =
  (...files: readonly string[]) =>
  (row: InventoryRow) =>
    test(row) && files.includes(row.source);
const underDir = (dir: string) => (row: InventoryRow) =>
  test(row) && row.source.startsWith(dir);
const titled =
  (files: readonly string[], pattern: RegExp) => (row: InventoryRow) =>
    test(row) && files.includes(row.source) && pattern.test(row.title);
const ids =
  (...wanted: readonly string[]) =>
  (row: InventoryRow) =>
    wanted.includes(row.id);
const idPrefix = (prefix: string) => (row: InventoryRow) =>
  row.id.startsWith(prefix);
const red = (row: InventoryRow) => test(row) && row.baseline === "baseline-red";

// First matching rule wins; every inventory row must match one.
const PE_RULES: readonly Rule[] = [
  {
    match: red,
    slice: "evaluation-web",
    testClass: "A",
    disposition: "pending-decision",
    decision: D.redClock,
  },

  // Phase 3: pure Evaluation core.
  {
    match: inFiles(
      "apps/server/src/evaluation/assessment-localization.test.ts",
      "apps/server/src/evaluation/evaluation-model.test.ts",
      "apps/server/src/evaluation/live-calibration.test.ts",
      "apps/server/src/evaluation/protected-content.test.ts",
      "apps/server/src/evaluation/rubric-v1.test.ts"
    ),
    slice: "evaluation-core",
    testClass: "A",
    disposition: "port",
  },

  // Phase 4b: persistence, SQLite to PGlite with assertions unchanged.
  {
    match: titled(["packages/db/src/index.test.ts"], /SQLite invariants/),
    slice: "evaluation-persistence",
    testClass: "B",
    disposition: "pending-decision",
    decision: D.persistence,
  },
  {
    match: titled(
      ["apps/server/src/evaluation/writing-evaluation.test.ts"],
      /oversized/
    ),
    slice: "evaluation-persistence",
    testClass: "B",
    disposition: "pending-decision",
    decision: D.caps,
  },
  {
    match: inFiles(
      "apps/server/src/evaluation/writing-evaluation.test.ts",
      "apps/server/src/history/learning-history.test.ts",
      "apps/server/src/progress/progress-insights.test.ts",
      "packages/db/src/index.test.ts"
    ),
    slice: "evaluation-persistence",
    testClass: "B",
    disposition: "port",
  },

  // Phase 4c: the Judge. The provider is an open decision.
  {
    match: inFiles(
      "apps/server/src/evaluation/openai-evaluation-model.test.ts"
    ),
    slice: "evaluation-judge",
    testClass: "C",
    disposition: "pending-decision",
    decision: D.providers,
  },

  // Phase 4d: HTTP edge.
  {
    match: titled(["apps/server/src/app.test.ts"], /oversized request bodies/),
    slice: "evaluation-http",
    testClass: "C",
    disposition: "pending-decision",
    decision: D.caps,
  },
  {
    match: titled(
      ["apps/server/src/app.test.ts"],
      /serves retained History, Progress/
    ),
    slice: "evaluation-http",
    testClass: "C",
    disposition: "pending-decision",
    decision: D.urlSelection,
  },
  {
    match: inFiles(
      "apps/server/src/app.test.ts",
      "apps/server/src/app.integration.test.ts",
      "apps/server/src/test/dev-proxy.test.ts"
    ),
    slice: "evaluation-http",
    testClass: "C",
    disposition: "port",
  },

  // Phase 4e: web, against the in-memory client first.
  {
    match: titled(
      ["apps/web/src/features/evaluations/http-evaluation-client.test.ts"],
      /source evidence/
    ),
    slice: "evaluation-web",
    testClass: "A",
    disposition: "pending-decision",
    decision: D.urlSelection,
  },
  {
    match: underDir("apps/web/"),
    slice: "evaluation-web",
    testClass: "A",
    disposition: "port",
  },

  // Phase 4f: E2E and the local-profile docker smoke.
  {
    match: underDir("e2e/"),
    slice: "evaluation-e2e",
    testClass: "A",
    disposition: "port",
  },
  {
    match: (row) =>
      row.kind === "smoke-check" &&
      /openai\/gpt-5\.6-terra|OpenRouter/.test(JSON.stringify(row)),
    slice: "evaluation-e2e",
    disposition: "pending-decision",
    decision: D.providers,
  },
  {
    match: idPrefix("pe:docker-smoke:"),
    slice: "evaluation-e2e",
    disposition: "port",
  },

  // Configuration moves to the deploy-profile Config.
  {
    match: inFiles("packages/env/src/server.test.ts"),
    slice: "platform",
    testClass: "A",
    disposition: "pending-decision",
    decision: D.profiles,
  },

  // Product contract and policy.
  {
    match: ids(
      "pe:requirement:FR-02",
      "pe:requirement:FR-03",
      "pe:requirement:FR-24"
    ),
    slice: "evaluation-policy",
    disposition: "pending-decision",
    decision: D.profiles,
  },
  {
    match: idPrefix("pe:requirement:"),
    slice: "evaluation-policy",
    disposition: "port",
  },
  {
    match: idPrefix("pe:rubric:"),
    slice: "evaluation-policy",
    disposition: "port",
  },
  {
    match: ids("pe:data-policy:stored-locally:01"),
    slice: "evaluation-policy",
    disposition: "pending-decision",
    decision: D.persistence,
  },
  {
    match: (row) =>
      row.id.startsWith("pe:data-policy:") &&
      /telemetry/i.test(JSON.stringify(row)),
    slice: "evaluation-policy",
    disposition: "pending-decision",
    decision: D.analytics,
  },
  {
    match: (row) =>
      row.id.startsWith("pe:data-policy:external-transmission:") ||
      /OPENROUTER_API_KEY/.test(JSON.stringify(row)),
    slice: "evaluation-policy",
    disposition: "pending-decision",
    decision: D.providers,
  },
  {
    match: idPrefix("pe:data-policy:"),
    slice: "evaluation-policy",
    disposition: "port",
  },
];

const G = "src/";
const GRIFANDO_RULES: readonly Rule[] = [
  // Writing analysis becomes Evaluation plus enrichment (scores, fields, spans).
  {
    match: inFiles(`${G}server/domain/progress/progress.test.ts`),
    slice: "academy-core",
    testClass: "A",
    disposition: "pending-decision",
    decision: D.scores,
  },
  {
    match: inFiles(
      `${G}server/ai/prompts/writingAnalysis.test.ts`,
      `${G}server/ai/schemas/writingAnalysis.test.ts`
    ),
    slice: "academy-trainer",
    testClass: "A",
    disposition: "pending-decision",
    decision: D.writingAnalysis,
  },
  {
    match: titled(
      [
        `${G}server/ai/providers/anthropic.test.ts`,
        `${G}server/ai/providers/gemini.test.ts`,
      ],
      /analyzeWriting/
    ),
    slice: "academy-trainer",
    testClass: "C",
    disposition: "pending-decision",
    decision: D.writingAnalysis,
  },
  {
    match: titled(
      [
        `${G}server/ai/providers/anthropic.test.ts`,
        `${G}server/ai/providers/gemini.test.ts`,
      ],
      /testKey/
    ),
    slice: "hosted",
    testClass: "C",
    disposition: "pending-decision",
    decision: D.profiles,
  },
  {
    match: inFiles(
      `${G}server/domain/writing/writingCoachService.test.ts`,
      `${G}server/domain/writing/writingSession.repository.test.ts`
    ),
    slice: "academy-persistence",
    testClass: "B",
    disposition: "pending-decision",
    decision: D.writingAnalysis,
  },
  {
    match: inFiles(`${G}app/api/writing-sessions/route.test.ts`),
    slice: "academy-http",
    testClass: "C",
    disposition: "pending-decision",
    decision: D.writingAnalysis,
  },
  {
    match: inFiles(
      `${G}lib/highlightSegments.test.ts`,
      `${G}components/home/specimenData.test.ts`
    ),
    slice: "academy-web",
    testClass: "A",
    disposition: "pending-decision",
    decision: D.writingAnalysis,
  },
  {
    match: inFiles(`${G}server/domain/interview/interviewService.test.ts`),
    slice: "academy-persistence",
    testClass: "B",
    disposition: "pending-decision",
    decision: D.interview,
  },

  // Phase 3: pure Academy core.
  {
    match: inFiles(
      ...[
        "exercises/answerChecking",
        "exercises/difficulty",
        "exercises/exerciseType",
        "exercises/publicView",
        "exercises/selection",
        "mistakes/analytics",
        "mistakes/mastery",
        "mistakes/patternKey",
        "mistakes/recall",
        "progress/streak",
        "writing/dailyPrompt",
        "writing/technicalPrompts",
      ].map((module) => `${G}server/domain/${module}.test.ts`),
      `${G}lib/answerDiff.test.ts`
    ),
    slice: "academy-core",
    testClass: "A",
    disposition: "port",
  },

  // Phase 5c: the Trainer.
  {
    match: inFiles(
      `${G}server/ai/prompts/answerExplanation.test.ts`,
      `${G}server/ai/prompts/exerciseGeneration.test.ts`,
      `${G}server/ai/prompts/interview.test.ts`,
      `${G}server/ai/schemas/exerciseGeneration.test.ts`
    ),
    slice: "academy-trainer",
    testClass: "A",
    disposition: "port",
  },
  {
    match: inFiles(
      `${G}server/ai/providers/anthropic.test.ts`,
      `${G}server/ai/providers/gemini.test.ts`,
      `${G}server/ai/resilient.test.ts`
    ),
    slice: "academy-trainer",
    testClass: "C",
    disposition: "port",
  },
  {
    match: inFiles(`${G}server/ai/noKeyInLogs.test.ts`),
    slice: "academy-trainer",
    testClass: "C",
    disposition: "port",
  },

  // Phase 5a, 5b and 5d: Academy persistence.
  {
    match: inFiles(
      `${G}server/domain/exercises/exerciseService.test.ts`,
      `${G}server/domain/mistakes/mistakePattern.repository.test.ts`,
      `${G}server/domain/vocabulary/vocabulary.repository.test.ts`
    ),
    slice: "academy-persistence",
    testClass: "B",
    disposition: "port",
  },

  // Phase 5e: Academy HTTP.
  {
    match: inFiles(`${G}app/api/exercises/route.test.ts`),
    slice: "academy-http",
    testClass: "C",
    disposition: "port",
  },

  // Phase 6: Focus Music.
  {
    match: inFiles(
      `${G}lib/musicLink.test.ts`,
      `${G}lib/savedPlaylists.test.ts`
    ),
    slice: "academy-web",
    testClass: "A",
    disposition: "port",
  },

  // Phase 6: hosted profile and BYOK, kept only if the hosted profile is.
  {
    match: inFiles(`${G}app/api/cron/cleanup/route.test.ts`),
    slice: "hosted",
    testClass: "C",
    disposition: "pending-decision",
    decision: D.cleanup,
  },
  {
    match: inFiles(
      `${G}app/api/ai-key/test/route.test.ts`,
      `${G}app/api/me/route.test.ts`,
      `${G}proxy.test.ts`,
      `${G}server/session/currentUser.test.ts`,
      `${G}server/session/getCurrentUserId.test.ts`
    ),
    slice: "hosted",
    testClass: "C",
    disposition: "pending-decision",
    decision: D.profiles,
  },
  {
    match: inFiles(
      `${G}server/rateLimit.test.ts`,
      `${G}server/domain/privacy/cleanup.test.ts`
    ),
    slice: "hosted",
    testClass: "B",
    disposition: "pending-decision",
    decision: D.profiles,
  },
  {
    match: inFiles(
      `${G}app/sitemap.test.ts`,
      `${G}lib/aiKeyStore.test.ts`,
      `${G}server/ai/credentials.test.ts`,
      `${G}server/clientIp.test.ts`,
      `${G}server/session/sessionToken.test.ts`
    ),
    slice: "hosted",
    testClass: "A",
    disposition: "pending-decision",
    decision: D.profiles,
  },
  {
    match: idPrefix("grifando:deploy-smoke:"),
    slice: "hosted",
    disposition: "pending-decision",
    decision: D.profiles,
  },

  // SPEC.md sections.
  {
    match: ids(
      "grifando:spec:1",
      "grifando:spec:2",
      "grifando:spec:4",
      "grifando:spec:5",
      "grifando:spec:7",
      "grifando:spec:10"
    ),
    slice: "academy-spec",
    disposition: "informative",
  },
  {
    match: ids("grifando:spec:3"),
    slice: "academy-spec",
    disposition: "pending-decision",
    decision: D.practice,
  },
  {
    match: ids("grifando:spec:5.1"),
    slice: "academy-spec",
    disposition: "pending-decision",
    decision: D.writingAnalysis,
  },
  {
    match: ids("grifando:spec:5.8"),
    slice: "academy-spec",
    disposition: "pending-decision",
    decision: D.interview,
  },
  {
    match: ids("grifando:spec:5.9"),
    slice: "academy-spec",
    disposition: "pending-decision",
    decision: D.scores,
  },
  {
    match: ids("grifando:spec:9"),
    slice: "academy-spec",
    disposition: "pending-decision",
    decision: D.providers,
  },
  {
    match: ids("grifando:spec:11"),
    slice: "academy-spec",
    disposition: "pending-decision",
    decision: D.profiles,
  },
  {
    match: idPrefix("grifando:spec:"),
    slice: "academy-spec",
    disposition: "port",
  },

  // CLAUDE.md bullets.
  {
    match: ids(
      "grifando:claude-md:architecture-rules:01",
      "grifando:claude-md:architecture-rules:02",
      "grifando:claude-md:architecture-rules:07",
      "grifando:claude-md:architecture-rules:08",
      "grifando:claude-md:architecture-rules:15",
      "grifando:claude-md:public-deployment-model:06"
    ),
    slice: "academy-spec",
    disposition: "informative",
  },
  {
    match: ids(
      "grifando:claude-md:architecture-rules:04",
      "grifando:claude-md:architecture-rules:06",
      "grifando:claude-md:public-deployment-model:01",
      "grifando:claude-md:public-deployment-model:03",
      "grifando:claude-md:public-deployment-model:04",
      "grifando:claude-md:public-deployment-model:05"
    ),
    slice: "academy-spec",
    disposition: "pending-decision",
    decision: D.profiles,
  },
  {
    match: ids("grifando:claude-md:architecture-rules:05"),
    slice: "academy-spec",
    disposition: "pending-decision",
    decision: D.writingAnalysis,
  },
  {
    match: ids("grifando:claude-md:architecture-rules:09"),
    slice: "academy-spec",
    disposition: "pending-decision",
    decision: D.providers,
  },
  {
    match: idPrefix("grifando:claude-md:"),
    slice: "academy-spec",
    disposition: "port",
  },

  // Fix commits.
  {
    match: ids("grifando:fix-commit:0083c7f"),
    slice: "academy-spec",
    disposition: "port",
  },
  {
    match: ids("grifando:fix-commit:80957b6"),
    slice: "academy-spec",
    disposition: "pending-decision",
    decision: D.providers,
  },
  {
    match: ids("grifando:fix-commit:9f5e47e", "grifando:fix-commit:397b0b4"),
    slice: "academy-spec",
    disposition: "pending-decision",
    decision: D.design,
  },
  {
    match: ids(
      "grifando:fix-commit:9ba8040",
      "grifando:fix-commit:2a86084",
      "grifando:fix-commit:8b80767"
    ),
    slice: "academy-spec",
    disposition: "pending-decision",
    decision: D.profiles,
  },
  {
    match: ids("grifando:fix-commit:032c115", "grifando:fix-commit:218b7b7"),
    slice: "academy-spec",
    disposition: "pending-decision",
    decision: D.writingAnalysis,
  },
  // Build, test and chore commits carry no product behavior.
  {
    match: (row) => row.kind === "fix-commit",
    slice: "academy-spec",
    disposition: "pending-decision",
    decision: D.protocol,
  },

  // Issues carry no behavior of their own: closed ones are covered by tests and SPEC
  // sections, open ones are requests outside parity. #77 and #78 are fixed by design.
  {
    match: ids("grifando:issue:77"),
    slice: "academy-spec",
    disposition: "pending-decision",
    decision: D.providers,
  },
  {
    match: ids("grifando:issue:78"),
    slice: "academy-spec",
    disposition: "pending-decision",
    decision: D.writingAnalysis,
  },
  {
    match: (row) => row.kind === "issue",
    slice: "academy-spec",
    disposition: "pending-decision",
    decision: D.protocol,
  },
];

const RULES: Readonly<Record<string, readonly Rule[]>> = {
  pe: PE_RULES,
  grifando: GRIFANDO_RULES,
};

export function seed(
  system: string,
  rows: readonly InventoryRow[]
): LedgerRow[] {
  const rules = RULES[system];
  if (rules === undefined)
    throw new BaselineError(`no ledger rules for "${system}"`);
  return rows.map((row) => {
    const rule = rules.find((candidate) => candidate.match(row));
    if (rule === undefined)
      throw new BaselineError(`${row.id}: no ledger rule matches`);
    if (SLICES[rule.slice] === undefined)
      throw new BaselineError(`${row.id}: unknown slice ${rule.slice}`);
    if (test(row) !== (rule.testClass !== undefined)) {
      throw new BaselineError(
        `${row.id}: test rows need a class and other rows must not have one`
      );
    }
    if (
      (rule.disposition === "pending-decision") !==
      (rule.decision !== undefined)
    ) {
      throw new BaselineError(
        `${row.id}: exactly the pending-decision rows name a decision`
      );
    }
    return {
      id: row.id,
      source: row.source,
      class: rule.testClass ?? null,
      slice: rule.slice,
      disposition: rule.disposition,
      decision: rule.decision ?? null,
      targets: [],
    };
  });
}

function main(argv: readonly string[]): void {
  const { values } = parseArgs({
    args: [...argv],
    options: { force: { type: "boolean", default: false } },
  });
  const inventoryDir = path.join(repoRoot, "docs", "migration", "inventory");
  const parityDir = path.join(repoRoot, "docs", "migration", "parity");
  if (
    existsSync(parityDir) &&
    readdirSync(parityDir).length > 0 &&
    !values.force
  ) {
    throw new BaselineError(
      `${path.relative(repoRoot, parityDir)} already holds the ledger; pass --force to reseed it`
    );
  }
  const bySlice = new Map<string, LedgerRow[]>();
  for (const system of Object.keys(RULES)) {
    const inventory = JSON.parse(
      readFileSync(path.join(inventoryDir, `${system}.json`), "utf8")
    ) as {
      readonly rows: readonly InventoryRow[];
    };
    for (const row of seed(system, inventory.rows)) {
      bySlice.set(row.slice, [...(bySlice.get(row.slice) ?? []), row]);
    }
  }
  mkdirSync(parityDir, { recursive: true });
  for (const [slice, rows] of [...bySlice.entries()].toSorted(([a], [b]) =>
    naturalCompare(a, b)
  )) {
    rows.sort((left, right) => naturalCompare(left.id, right.id));
    const ledger = { slice, lane: SLICES[slice], rows };
    writeFileSync(
      path.join(parityDir, `${slice}.json`),
      `${JSON.stringify(ledger, null, 2)}\n`
    );
    const pending = rows.filter(
      (row) => row.disposition === "pending-decision"
    ).length;
    console.error(
      `${slice}: ${rows.length} rows, ${pending} pending a decision`
    );
  }
}

if (import.meta.main) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
