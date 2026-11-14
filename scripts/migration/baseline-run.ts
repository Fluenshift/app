// Runs one baseline's test suites at its pinned commit and stores machine-readable reports in
// docs/migration/baseline-runs/<system>/, with a manifest.json that records the toolchain,
// the commands and each suite's exit code.
//
//   node scripts/migration/baseline-run.ts <system> [--root <dir>]
//
// The run happens in a fresh disposable worktree (<root>/worktrees/<system>-run), under a
// scrubbed environment: no inherited variables and a private empty HOME, so no credentials,
// credential files or AI keys reach the baseline code. Toolchains come from mise. Grifando
// gets a throwaway postgres:17-alpine container. Reports are normalized before they are
// stored: paths inside the worktree become repo-relative, home directories become "~", and
// bun's junit hostname attribute is dropped. Exits 1 when any suite fails; the reports are
// written either way.

import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, openSync, closeSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

import {
  addWorktree,
  BaselineError,
  defaultRoot,
  pinFor,
  readPins,
  removeWorktree,
  repoRoot,
  syncClone,
  worktreePath,
} from "./baselines.ts";

type Runner = "bun-junit" | "vitest-json" | "playwright-json";

interface Tool {
  readonly name: string;
  readonly version: string;
  readonly binDir: string;
}

interface Suite {
  readonly id: string;
  readonly cwd: string;
  readonly runner: Runner;
  readonly report: string;
  // "{report}" is replaced by the absolute path of the raw report.
  readonly command: readonly string[];
  readonly env?: Readonly<Record<string, string>>;
}

interface Postgres {
  readonly image: string;
  readonly user: string;
  readonly password: string;
  readonly database: string;
  readonly testDatabase: string;
  readonly prepare: readonly string[];
}

interface Plan {
  readonly tools: readonly Tool[];
  readonly pins: readonly (readonly [file: string, expected: RegExp])[];
  readonly install: readonly string[];
  readonly postgres?: Postgres;
  readonly suites: readonly Suite[];
}

const PLANS: Readonly<Record<string, Plan>> = {
  pe: {
    tools: [
      { name: "bun", version: "1.4.0", binDir: "bin" },
      // PE pins no Node; its Vitest and Playwright CLIs run on Node 24.
      { name: "node", version: "24.22.2", binDir: "bin" },
    ],
    pins: [
      ["mise.toml", /^bun = "1\.4\.0"$/m],
      ["package.json", /"packageManager": "bun@1\.4\.0"/],
      ["bun.lock", /"@playwright\/test@1\.63\.0"/],
    ],
    install: ["bun", "install", "--frozen-lockfile"],
    suites: [
      {
        id: "server",
        cwd: "apps/server",
        runner: "bun-junit",
        report: "server.junit.xml",
        command: ["bun", "run", "test", "--reporter=junit", "--reporter-outfile={report}"],
      },
      {
        id: "db",
        cwd: "packages/db",
        runner: "bun-junit",
        report: "db.junit.xml",
        command: ["bun", "run", "test", "--reporter=junit", "--reporter-outfile={report}"],
      },
      {
        id: "env",
        cwd: "packages/env",
        runner: "vitest-json",
        report: "env.vitest.json",
        command: ["bun", "run", "test", "--reporter=default", "--reporter=json", "--outputFile.json={report}"],
      },
      {
        id: "web",
        cwd: "apps/web",
        runner: "vitest-json",
        report: "web.vitest.json",
        command: ["bun", "run", "test", "--reporter=default", "--reporter=json", "--outputFile.json={report}"],
      },
      {
        id: "e2e",
        cwd: ".",
        runner: "playwright-json",
        report: "e2e.playwright.json",
        command: ["bun", "run", "test:e2e", "--reporter=list,json"],
        env: { PLAYWRIGHT_JSON_OUTPUT_FILE: "{report}" },
      },
    ],
  },
  grifando: {
    tools: [
      { name: "node", version: "24.22.2", binDir: "bin" },
      { name: "pnpm", version: "12.3.4", binDir: "." },
    ],
    pins: [
      [".nvmrc", /^24\s*$/],
      ["package.json", /"packageManager": "pnpm@12\.3\.4"/],
      [".github/workflows/ci.yml", /image: postgres:17-alpine/],
    ],
    install: ["pnpm", "install", "--frozen-lockfile"],
    postgres: {
      image: "postgres:17-alpine",
      user: "english_coach",
      password: "english_coach",
      database: "english_coach",
      testDatabase: "english_coach_test",
      prepare: ["pnpm", "db:test:prepare"],
    },
    suites: [
      {
        id: "vitest",
        cwd: ".",
        runner: "vitest-json",
        report: "vitest.json",
        // Its "test" script is "vitest run"; pnpm would claim --reporter as its own flag.
        command: ["pnpm", "exec", "vitest", "run", "--reporter=default", "--reporter=json", "--outputFile.json={report}"],
      },
    ],
  },
};

function capture(command: string, args: readonly string[]): string {
  try {
    return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    throw new BaselineError(`${command} ${args.join(" ")} failed: ${String(error)}`);
  }
}

function sleep(milliseconds: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function resolveTools(tools: readonly Tool[]): string[] {
  return tools.map((tool) => {
    const installDir = capture("mise", ["where", `${tool.name}@${tool.version}`]);
    const binDir = path.join(installDir, tool.binDir);
    if (!existsSync(binDir)) throw new BaselineError(`${tool.name}@${tool.version}: ${binDir} is missing`);
    return binDir;
  });
}

function checkPins(plan: Plan, worktree: string): void {
  for (const [file, expected] of plan.pins) {
    const text = readFileSync(path.join(worktree, file), "utf8");
    if (!expected.test(text)) {
      throw new BaselineError(`${file} no longer matches ${expected}; update the run plan with the toolchain`);
    }
  }
}

function substitute(values: readonly string[], report: string): string[] {
  return values.map((value) => value.replaceAll("{report}", report));
}

function run(command: readonly string[], cwd: string, env: NodeJS.ProcessEnv, log: string): number {
  const [file, ...args] = command;
  if (file === undefined) throw new BaselineError("empty command");
  const fd = openSync(log, "a");
  try {
    const result = spawnSync(file, args, { cwd, env, stdio: ["ignore", fd, fd] });
    if (result.error !== undefined) throw new BaselineError(`${file}: ${result.error.message}`);
    return result.status ?? 1;
  } finally {
    closeSync(fd);
  }
}

interface Service {
  readonly env: Readonly<Record<string, string>>;
  readonly record: { readonly image: string; readonly digest: string; readonly version: string };
  readonly stop: () => void;
}

function startPostgres(postgres: Postgres): Service {
  const name = `app-baseline-postgres-${process.pid}`;
  capture("docker", [
    "run", "--detach", "--rm", "--name", name,
    "--env", `POSTGRES_USER=${postgres.user}`,
    "--env", `POSTGRES_PASSWORD=${postgres.password}`,
    "--env", `POSTGRES_DB=${postgres.database}`,
    "--publish", "127.0.0.1::5432",
    postgres.image,
  ]);
  const stop = () => {
    spawnSync("docker", ["rm", "--force", name], { stdio: "ignore" });
  };
  try {
    const published = capture("docker", ["port", name, "5432/tcp"]).split("\n")[0] ?? "";
    const port = published.slice(published.lastIndexOf(":") + 1);
    let ready = false;
    for (let attempt = 0; attempt < 60 && !ready; attempt += 1) {
      const probe = spawnSync("docker", ["exec", name, "pg_isready", "-h", "127.0.0.1", "-U", postgres.user], {
        stdio: "ignore",
      });
      ready = probe.status === 0;
      if (!ready) sleep(1000);
    }
    if (!ready) throw new BaselineError(`${postgres.image} did not become ready`);
    const url = (database: string) =>
      `postgresql://${postgres.user}:${postgres.password}@127.0.0.1:${port}/${database}?schema=public`;
    const digests = capture("docker", ["image", "inspect", postgres.image, "--format", "{{json .RepoDigests}}"]);
    const [digest = ""] = JSON.parse(digests) as string[];
    return {
      env: { DATABASE_URL: url(postgres.database), TEST_DATABASE_URL: url(postgres.testDatabase) },
      record: {
        image: postgres.image,
        digest: digest.slice(digest.indexOf("@") + 1),
        version: capture("docker", ["exec", name, "postgres", "--version"]).replace(/^postgres \(PostgreSQL\) /, ""),
      },
      stop,
    };
  } catch (error) {
    stop();
    throw error;
  }
}

// Paths inside the worktree become repo-relative; the run's private home and the real home
// directory become "~"; bun's junit hostname attribute is dropped.
export function normalizeReport(text: string, worktree: string, homes: readonly string[], runner: Runner): string {
  let normalized = text.replaceAll(`${worktree}/`, "").replaceAll(worktree, ".");
  for (const home of homes) normalized = normalized.replaceAll(`${home}/`, "~/");
  if (runner === "bun-junit") normalized = normalized.replaceAll(/ hostname="[^"]*"/g, "");
  return normalized.endsWith("\n") ? normalized : `${normalized}\n`;
}

function main(argv: readonly string[]): number {
  const { values, positionals } = parseArgs({
    args: [...argv],
    allowPositionals: true,
    options: { root: { type: "string" } },
  });
  const [system, ...extra] = positionals;
  if (system === undefined || extra.length > 0) throw new BaselineError("usage: baseline-run.ts <system> [--root <dir>]");
  const plan = PLANS[system];
  if (plan === undefined) throw new BaselineError(`no run plan for "${system}"; known: ${Object.keys(PLANS).join(", ")}`);
  const root = values.root === undefined ? defaultRoot : path.resolve(values.root);
  const pin = pinFor(readPins(), system);

  syncClone(system, pin, root);
  if (existsSync(worktreePath(system, "run", root))) removeWorktree(system, "run", root);
  const worktree = addWorktree(system, pin, "run", root);
  checkPins(plan, worktree);

  const home = os.homedir();
  const scratch = mkdtempSync(path.join(os.tmpdir(), `baseline-run-${system}-`));
  const rawDir = path.join(scratch, "reports");
  mkdirSync(rawDir);
  // Baseline code never sees the real home directory, so no credential file (.npmrc, tool
  // configs) is reachable. Only content-addressed package caches and the Playwright browsers
  // are shared; they hold no credentials, and they keep installs fast and reproducible.
  const runHome = path.join(scratch, "home");
  mkdirSync(runHome);
  const log = path.join(scratch, "run.log");
  const pnpmStore = path.join(home, ".local", "share", "pnpm", "store");
  const baseEnv: NodeJS.ProcessEnv = {
    HOME: runHome,
    PLAYWRIGHT_BROWSERS_PATH: path.join(home, ".cache", "ms-playwright"),
    BUN_INSTALL_CACHE_DIR: path.join(home, ".bun", "install", "cache"),
    npm_config_store_dir: pnpmStore,
    pnpm_config_store_dir: pnpmStore,
    LANG: "C.UTF-8",
    TERM: "dumb",
    PATH: [...resolveTools(plan.tools), "/usr/local/bin", "/usr/bin", "/bin"].join(path.delimiter),
    HUSKY: "0",
    DO_NOT_TRACK: "1",
    TURBO_TELEMETRY_DISABLED: "1",
    NEXT_TELEMETRY_DISABLED: "1",
  };
  const ranAt = new Date().toISOString();
  console.error(`${system}: worktree ${worktree}; log ${log}`);

  if (run(plan.install, worktree, baseEnv, log) !== 0) throw new BaselineError(`${system}: install failed; see ${log}`);

  const service = plan.postgres === undefined ? undefined : startPostgres(plan.postgres);
  const results: { suite: Suite; exitCode: number }[] = [];
  try {
    const env = { ...baseEnv, ...service?.env };
    if (plan.postgres !== undefined && run(plan.postgres.prepare, worktree, env, log) !== 0) {
      throw new BaselineError(`${system}: database preparation failed; see ${log}`);
    }
    for (const suite of plan.suites) {
      const raw = path.join(rawDir, suite.report);
      const suiteEnv = { ...env, ...Object.fromEntries(Object.entries(suite.env ?? {}).map(([k, v]) => [k, v.replaceAll("{report}", raw)])) };
      const exitCode = run(substitute(suite.command, raw), path.join(worktree, suite.cwd), suiteEnv, log);
      if (!existsSync(raw)) throw new BaselineError(`${system}/${suite.id}: no report written (exit ${exitCode}); see ${log}`);
      results.push({ suite, exitCode });
      console.error(`${system}/${suite.id}: exit ${exitCode}`);
    }
  } finally {
    service?.stop();
  }

  const outDir = path.join(repoRoot, "docs", "migration", "baseline-runs", system);
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  for (const { suite } of results) {
    const text = readFileSync(path.join(rawDir, suite.report), "utf8");
    writeFileSync(path.join(outDir, suite.report), normalizeReport(text, worktree, [runHome, home], suite.runner));
  }
  const manifest = {
    system,
    repository: pin.repository,
    tag: pin.tag,
    commit: pin.commit,
    ranAt,
    tools: plan.tools.map(({ name, version }) => ({ name, version })),
    services: service === undefined ? [] : [service.record],
    install: plan.install,
    suites: results.map(({ suite, exitCode }) => ({
      id: suite.id,
      cwd: suite.cwd,
      runner: suite.runner,
      command: suite.command.map((part) => part.replaceAll("{report}", suite.report)),
      env: Object.fromEntries(Object.entries(suite.env ?? {}).map(([k, v]) => [k, v.replaceAll("{report}", suite.report)])),
      report: suite.report,
      exitCode,
    })),
  };
  writeFileSync(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  rmSync(rawDir, { recursive: true, force: true });
  console.error(`${system}: reports in ${path.relative(repoRoot, outDir)}`);
  return results.every(({ exitCode }) => exitCode === 0) ? 0 : 1;
}

if (import.meta.main) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}
