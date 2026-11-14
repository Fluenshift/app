// Reads and runs the source baselines only at their pinned commits.
//
// The pins in docs/migration/baselines.json are the authority. Each source repository is
// cloned outside this working tree (default ../<product>-baselines/<system>), and every
// command first checks that the remote tag still resolves to the pinned commit.
//
// Runs on plain Node 26 (type stripping), with no dependencies:
//
//   node scripts/migration/baselines.ts verify [system...]
//   node scripts/migration/baselines.ts sync [system...]
//   node scripts/migration/baselines.ts path <system>
//   node scripts/migration/baselines.ts add-worktree <system> <name>
//   node scripts/migration/baselines.ts remove-worktree <system> <name>
//
// Option: --root <dir> replaces the default clone root.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

export interface Pin {
  readonly repository: string;
  readonly tag: string;
  readonly commit: string;
}

export type Pins = ReadonlyMap<string, Pin>;

export class BaselineError extends Error {
  override name = "BaselineError";
}

export const repoRoot = path.resolve(import.meta.dirname, "..", "..");
export const pinsFile = path.join(repoRoot, "docs", "migration", "baselines.json");
export const defaultRoot = path.resolve(repoRoot, "..", `${path.basename(repoRoot)}-baselines`);

const SYSTEM = /^[a-z][a-z0-9-]*$/;
const REPOSITORY = /^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/;
const TAG = /^parity-baseline(-[2-9]|-[1-9][0-9]+)?$/;
const COMMIT = /^[0-9a-f]{40}$/;
const WORKTREE_NAME = /^[a-z0-9][a-z0-9-]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function field(entry: Record<string, unknown>, key: string, pattern: RegExp, where: string): string {
  const value = entry[key];
  if (typeof value !== "string" || !pattern.test(value)) {
    throw new BaselineError(`${where}.${key} must match ${pattern}`);
  }
  return value;
}

export function parsePins(text: string, source = pinsFile): Pins {
  const data: unknown = JSON.parse(text);
  if (!isRecord(data)) throw new BaselineError(`${source}: expected an object of pins`);
  const pins = new Map<string, Pin>();
  for (const [system, entry] of Object.entries(data)) {
    const where = `${source}: ${system}`;
    if (!SYSTEM.test(system)) throw new BaselineError(`${where}: system name must match ${SYSTEM}`);
    if (!isRecord(entry)) throw new BaselineError(`${where}: expected an object`);
    const keys = Object.keys(entry).sort().join(",");
    if (keys !== "commit,repository,tag") {
      throw new BaselineError(`${where}: expected exactly the keys commit, repository, tag`);
    }
    pins.set(system, {
      repository: field(entry, "repository", REPOSITORY, where),
      tag: field(entry, "tag", TAG, where),
      commit: field(entry, "commit", COMMIT, where),
    });
  }
  if (pins.size === 0) throw new BaselineError(`${source}: no pins`);
  return pins;
}

export function readPins(file = pinsFile): Pins {
  return parsePins(readFileSync(file, "utf8"), path.relative(repoRoot, file));
}

export function pinFor(pins: Pins, system: string): Pin {
  const pin = pins.get(system);
  if (pin === undefined) {
    throw new BaselineError(`unknown system "${system}"; known: ${[...pins.keys()].join(", ")}`);
  }
  return pin;
}

export function remoteUrl(pin: Pin): string {
  return `https://github.com/${pin.repository}.git`;
}

export function clonePath(system: string, root = defaultRoot): string {
  return path.join(root, system);
}

export function worktreePath(system: string, name: string, root = defaultRoot): string {
  if (!WORKTREE_NAME.test(name)) throw new BaselineError(`worktree name must match ${WORKTREE_NAME}`);
  return path.join(root, "worktrees", `${system}-${name}`);
}

export function git(args: readonly string[], cwd?: string): string {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 256 * 1024 * 1024,
    }).trimEnd();
  } catch (error) {
    const stderr = isRecord(error) && typeof error["stderr"] === "string" ? error["stderr"].trim() : "";
    throw new BaselineError(`git ${args.join(" ")} failed${stderr === "" ? "" : `: ${stderr}`}`);
  }
}

// The commit the remote tag points to: the peeled entry for an annotated tag, the ref itself
// for a lightweight one.
export function resolveRemoteTag(pin: Pin): string {
  const ref = `refs/tags/${pin.tag}`;
  const output = git(["ls-remote", remoteUrl(pin), ref, `${ref}^{}`]);
  const refs = new Map<string, string>();
  for (const line of output.split("\n")) {
    const [sha, name] = line.split("\t");
    if (sha !== undefined && name !== undefined) refs.set(name, sha);
  }
  const commit = refs.get(`${ref}^{}`) ?? refs.get(ref);
  if (commit === undefined) throw new BaselineError(`${pin.repository}: tag ${pin.tag} not found on the remote`);
  return commit;
}

export function verifyRemote(system: string, pin: Pin): void {
  const commit = resolveRemoteTag(pin);
  if (commit !== pin.commit) {
    throw new BaselineError(
      `${system}: ${pin.repository} tag ${pin.tag} resolves to ${commit}, but the pin is ${pin.commit}`,
    );
  }
}

// The clone must come from the pinned repository and hold no edits; baselines are never
// edited, so anything else means the clone cannot be trusted as a reference.
function assertCleanClone(dir: string, pin: Pin): void {
  const origin = git(["remote", "get-url", "origin"], dir);
  if (origin !== remoteUrl(pin)) {
    throw new BaselineError(`${dir}: origin is ${origin}, expected ${remoteUrl(pin)}`);
  }
  const status = git(["status", "--porcelain"], dir);
  if (status !== "") {
    throw new BaselineError(`${dir}: working tree is not clean; baselines are never edited`);
  }
}

function assertPinnedCheckout(dir: string, pin: Pin): void {
  const head = git(["rev-parse", "HEAD"], dir);
  if (head !== pin.commit) throw new BaselineError(`${dir}: HEAD is ${head}, expected ${pin.commit}`);
}

// Clones the repository if needed, then checks out the pinned commit, detached. Refuses a
// clone whose origin differs from the pin or whose working tree is not clean.
export function syncClone(system: string, pin: Pin, root = defaultRoot): string {
  verifyRemote(system, pin);
  const dir = clonePath(system, root);
  if (existsSync(dir)) {
    assertCleanClone(dir, pin);
    git(["fetch", "--quiet", "--no-tags", "origin", pin.commit], dir);
  } else {
    git(["clone", "--quiet", "--no-checkout", remoteUrl(pin), dir]);
  }
  git(["-c", "advice.detachedHead=false", "checkout", "--quiet", "--detach", pin.commit], dir);
  assertPinnedCheckout(dir, pin);
  return dir;
}

// A disposable worktree at the pinned commit, for installs, suite runs and characterization
// tests. The clone itself stays pristine.
export function addWorktree(system: string, pin: Pin, name: string, root = defaultRoot): string {
  const clone = clonePath(system, root);
  if (!existsSync(clone)) throw new BaselineError(`${clone} is missing; run sync first`);
  assertCleanClone(clone, pin);
  assertPinnedCheckout(clone, pin);
  const dir = worktreePath(system, name, root);
  if (existsSync(dir)) throw new BaselineError(`${dir} already exists; remove it first`);
  git(["worktree", "add", "--quiet", "--detach", dir, pin.commit], clone);
  assertPinnedCheckout(dir, pin);
  return dir;
}

export function removeWorktree(system: string, name: string, root = defaultRoot): void {
  const clone = clonePath(system, root);
  git(["worktree", "remove", "--force", worktreePath(system, name, root)], clone);
  git(["worktree", "prune"], clone);
}

function selectSystems(pins: Pins, requested: readonly string[]): string[] {
  if (requested.length === 0) return [...pins.keys()];
  for (const system of requested) pinFor(pins, system);
  return [...requested];
}

function main(argv: readonly string[]): void {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: { root: { type: "string" } },
  });
  const root = values.root === undefined ? defaultRoot : path.resolve(values.root);
  const [command, ...rest] = positionals;
  const pins = readPins();

  switch (command) {
    case "verify":
      for (const system of selectSystems(pins, rest)) {
        verifyRemote(system, pinFor(pins, system));
        console.error(`${system}: ${pinFor(pins, system).tag} resolves to the pin`);
      }
      return;
    case "sync":
      for (const system of selectSystems(pins, rest)) {
        console.log(syncClone(system, pinFor(pins, system), root));
      }
      return;
    case "path": {
      const [system] = rest;
      if (system === undefined || rest.length !== 1) throw new BaselineError("usage: path <system>");
      pinFor(pins, system);
      console.log(clonePath(system, root));
      return;
    }
    case "add-worktree": {
      const [system, name] = rest;
      if (system === undefined || name === undefined || rest.length !== 2) {
        throw new BaselineError("usage: add-worktree <system> <name>");
      }
      const pin = pinFor(pins, system);
      verifyRemote(system, pin);
      console.log(addWorktree(system, pin, name, root));
      return;
    }
    case "remove-worktree": {
      const [system, name] = rest;
      if (system === undefined || name === undefined || rest.length !== 2) {
        throw new BaselineError("usage: remove-worktree <system> <name>");
      }
      verifyRemote(system, pinFor(pins, system));
      removeWorktree(system, name, root);
      return;
    }
    default:
      throw new BaselineError(
        "usage: baselines.ts <verify|sync|path|add-worktree|remove-worktree> [args] [--root <dir>]",
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
