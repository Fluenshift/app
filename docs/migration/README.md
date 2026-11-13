# Migration records

Working records for the Prompt Evolution + Grifando merge. The process is defined in
[`MIGRATION_PROTOCOL.md`](./MIGRATION_PROTOCOL.md); the setup is in [`HANDOFF.md`](./HANDOFF.md).
Every JSON file in this directory is pure data. Prose about it lives here.

| Path | Contents |
| --- | --- |
| [`baselines.json`](./baselines.json) | The pinned source commits. |
| [`BASELINES.md`](./BASELINES.md) | Toolchains, run commands and recorded results for each baseline. |
| [`baseline-runs/<system>/`](./baseline-runs/) | Normalized test reports from the baselines, with a `manifest.json` per system. |

## `baselines.json`

One entry per source system, keyed by system name (`pe`, `grifando`). Each entry has exactly
three fields:

| Field | Meaning |
| --- | --- |
| `repository` | GitHub `owner/name` of the source repository. |
| `tag` | `parity-baseline`, or `parity-baseline-N` after a baseline bump. |
| `commit` | The full SHA the tag resolves to. This is the authority. |

Only the coordinator changes this file, in a baseline bump (`MIGRATION_PROTOCOL.md` §
Baseline bumps). `scripts/migration/baselines.ts` rejects any other field.

## `baseline-runs/<system>/manifest.json`

Written by `scripts/migration/baseline-run.ts`. One object:

| Field | Meaning |
| --- | --- |
| `system`, `repository`, `tag`, `commit` | The pin the run used. |
| `ranAt` | Start of the run, ISO 8601 UTC. Some baseline tests read the clock, so it matters. |
| `tools` | `name` and exact `version` of each tool on the run's `PATH`. |
| `services` | Containers the run started: `image`, its `digest` and the server `version`. |
| `install` | The install command. |
| `suites` | One entry per suite: `id`; `cwd`, relative to the baseline root; `runner` (`bun-junit`, `vitest-json` or `playwright-json`); `command` and extra `env`, with the report file name in place of its temporary path; `report`, the file next to the manifest; and `exitCode`. |

Paths inside the reports are relative to the suite's `cwd` for `bun-junit`, relative to the
baseline root for `vitest-json`, and relative to the Playwright `testDir` (itself
baseline-relative) for `playwright-json`.

## Issue labels

Work units and decision requests are GitHub Issues in this repository. State lives in labels,
never in files; a closed issue is done.

| Group | Labels |
| --- | --- |
| Status | `needs-triage`, `ready-for-agent`, `in-progress`, `in-review`, `needs-info`, `ready-for-human`, `wontfix` |
| Lane | `lane:evaluation`, `lane:academy`, `lane:platform` |
| Implementer | `implementer:claude`, `implementer:codex`, on the unit issue and its PR |
| Decision | `decision`: an owner decision request, including ADR acceptance |

## G12 verdict format

The verifier comes from the vendor that did not implement the unit. It posts one PR comment
that starts with exactly these three lines:

```text
G12 PASS
Verifier: codex
Head: <full head SHA>
```

The first line is `G12 PASS` or `G12 BLOCK`. `Verifier` names the verifying vendor (`claude`
or `codex`) and must differ from the PR's `implementer:` label. Reasons follow, and are
required for BLOCK. A verdict covers only that head SHA; any new commit needs a new verdict.
Until Phase 2 builds CI, the coordinator checks verdicts by hand.

## Mechanical mapping

Changes allowed when a `port` row's test moves to the target stack. The title stays verbatim
and the assertions stay as they are.

| Source | Target |
| --- | --- |
| `bun:test` | `vitest` |
| `spyOn` | `vi.spyOn` |
| `import.meta.dir` | `import.meta.dirname` |
| `Bun.env` | Effect Config |
| SQLite temporary files | PGlite |
| Elysia `app.handle`, Next.js route handlers | Hono `app.request` |
| Prisma enums | literals from `packages/contract` |
| SDK fakes (openai, Anthropic, Gemini) | AI SDK mock models |
