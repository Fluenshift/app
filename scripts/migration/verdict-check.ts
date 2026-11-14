// Gate G12: a PR merges only with a cross-vendor verdict for its current head.
//
//   node scripts/migration/verdict-check.ts --repo <owner/name> --pr <number> [--set-status]
//
// Reads the PR and its comments through the `gh` CLI. A verdict is a comment whose first
// three lines are:
//
//   G12 PASS          (or G12 BLOCK)
//   Verifier: codex   (or claude)
//   Head: <full head SHA>
//
// The gate passes only when the newest verdict for the current head SHA says PASS, its
// verifier differs from the vendor in the PR's `implementer:` label, and its author is an
// organization member. Without --set-status it exits 1 when the gate does not pass. With
// --set-status it records the result as the `G12` commit status on the head SHA and exits 0:
// the status is the gate, and a comment that is not a verdict is no failure of the workflow.

import { execFileSync } from "node:child_process";
import { parseArgs } from "node:util";

import { BaselineError } from "./baselines.ts";

export const VENDORS = new Set(["claude", "codex"]);
const MEMBER_ASSOCIATIONS = new Set(["OWNER", "MEMBER"]);
const HEADER =
  /^G12 (PASS|BLOCK)\r?\nVerifier: ([a-z]+)\r?\nHead: ([0-9a-f]{40})\s*(?:\r?\n|$)/;

export interface Verdict {
  readonly pass: boolean;
  readonly verifier: string;
  readonly head: string;
}

export interface Comment {
  readonly id: number;
  readonly body: string;
  readonly createdAt: string;
  readonly author: string;
  readonly association: string;
}

export interface PullRequest {
  readonly headSha: string;
  readonly labels: readonly string[];
}

export interface Evaluation {
  readonly pass: boolean;
  readonly description: string;
}

export function parseVerdict(body: string): Verdict | undefined {
  const match = HEADER.exec(body);
  if (match === null) return undefined;
  const [, outcome = "", verifier = "", head = ""] = match;
  return { pass: outcome === "PASS", verifier, head };
}

export function evaluate(
  pr: PullRequest,
  comments: readonly Comment[]
): Evaluation {
  const implementers = pr.labels
    .filter((label) => label.startsWith("implementer:"))
    .map((label) => label.slice("implementer:".length));
  const [implementer] = implementers;
  if (
    implementer === undefined ||
    implementers.length !== 1 ||
    !VENDORS.has(implementer)
  )
    return {
      pass: false,
      description:
        "the PR needs exactly one implementer:claude or implementer:codex label",
    };

  const verdicts = comments
    .map((comment) => ({ comment, verdict: parseVerdict(comment.body) }))
    .filter(
      ({ comment, verdict }) =>
        verdict?.head === pr.headSha &&
        MEMBER_ASSOCIATIONS.has(comment.association)
    )
    .toSorted((left, right) =>
      left.comment.createdAt === right.comment.createdAt
        ? left.comment.id - right.comment.id
        : left.comment.createdAt.localeCompare(right.comment.createdAt)
    );
  const newest = verdicts.at(-1);
  if (newest?.verdict === undefined)
    return {
      pass: false,
      description: `no verdict from an organization member for ${pr.headSha.slice(0, 7)}`,
    };
  const { verdict, comment } = newest;
  if (!VENDORS.has(verdict.verifier))
    return {
      pass: false,
      description: `unknown verifier "${verdict.verifier}"`,
    };
  if (verdict.verifier === implementer)
    return {
      pass: false,
      description: `the verifier is the implementing vendor (${implementer})`,
    };
  if (!verdict.pass)
    return {
      pass: false,
      description: `blocked by ${verdict.verifier} (comment ${comment.id})`,
    };
  return {
    pass: true,
    description: `passed by ${verdict.verifier} (comment ${comment.id})`,
  };
}

function gh(args: readonly string[]): unknown {
  try {
    return JSON.parse(
      execFileSync("gh", args, {
        encoding: "utf8",
        maxBuffer: 64 * 1024 * 1024,
        stdio: ["ignore", "pipe", "pipe"],
      })
    );
  } catch (error) {
    throw new BaselineError(`gh ${args.join(" ")} failed: ${String(error)}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fetchPullRequest(repo: string, pr: number): PullRequest {
  const data = gh(["api", `repos/${repo}/pulls/${pr}`]);
  if (
    !isRecord(data) ||
    !isRecord(data["head"]) ||
    typeof data["head"]["sha"] !== "string"
  )
    throw new BaselineError(`PR ${pr}: unexpected response`);
  const labels = Array.isArray(data["labels"]) ? data["labels"] : [];
  return {
    headSha: data["head"]["sha"],
    labels: labels.flatMap((label) =>
      isRecord(label) && typeof label["name"] === "string"
        ? [label["name"]]
        : []
    ),
  };
}

export const PAGE_SIZE = 100;

// Reads numbered pages until one comes back short. `gh api --paginate --slurp` would do the
// same, but --slurp needs gh 2.48 or later.
export function collectPages(
  fetchPage: (page: number) => unknown,
  pageSize = PAGE_SIZE
): unknown[] {
  const items: unknown[] = [];
  let page = 1;
  let more = true;
  while (more) {
    const data = fetchPage(page);
    if (!Array.isArray(data))
      throw new BaselineError(`page ${page}: expected a JSON array`);
    items.push(...data);
    more = data.length === pageSize;
    page += 1;
  }
  return items;
}

function fetchComments(repo: string, pr: number): Comment[] {
  const items = collectPages((page) =>
    gh([
      "api",
      `repos/${repo}/issues/${pr}/comments?per_page=${PAGE_SIZE}&page=${page}`,
    ])
  );
  return items.flatMap((comment: unknown) => {
    if (
      !isRecord(comment) ||
      typeof comment["body"] !== "string" ||
      typeof comment["id"] !== "number"
    )
      return [];
    const user = isRecord(comment["user"]) ? comment["user"] : {};
    return [
      {
        id: comment["id"],
        body: comment["body"],
        createdAt: String(comment["created_at"]),
        author: String(user["login"]),
        association: String(comment["author_association"]),
      },
    ];
  });
}

function main(argv: readonly string[]): number {
  const { values } = parseArgs({
    args: [...argv],
    options: {
      repo: { type: "string" },
      pr: { type: "string" },
      "set-status": { type: "boolean", default: false },
    },
  });
  const { repo } = values;
  const pr = Number(values.pr);
  if (
    repo === undefined ||
    !/^[\w.-]+\/[\w.-]+$/.test(repo) ||
    !Number.isInteger(pr) ||
    pr <= 0
  )
    throw new BaselineError(
      "usage: verdict-check.ts --repo <owner/name> --pr <number> [--set-status]"
    );
  const pullRequest = fetchPullRequest(repo, pr);
  const result = evaluate(pullRequest, fetchComments(repo, pr));
  console.error(`G12 ${result.pass ? "pass" : "fail"}: ${result.description}`);
  if (values["set-status"])
    gh([
      "api",
      "--method",
      "POST",
      `repos/${repo}/statuses/${pullRequest.headSha}`,
      "-f",
      `state=${result.pass ? "success" : "failure"}`,
      "-f",
      "context=G12",
      "-f",
      `description=${result.description.slice(0, 140)}`,
    ]);
  return result.pass || values["set-status"] ? 0 : 1;
}

if (import.meta.main) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
