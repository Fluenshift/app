// Gate G6 for the local profile: builds the image, starts it with Docker Compose as the invoking
// user, and checks its boundary, its data directory and what it serves. Ported from PE
// `scripts/docker-smoke.ts`.
import { existsSync, statSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { seedDockerSmoke } from "server/seed-docker-smoke";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  composeOf,
  fetchResponse,
  hostileHostStatus,
  leakedSentinels,
  plant,
  probeNonLoopback,
  randomLetters,
  removeProject,
  REPOSITORY_ROOT,
  reserveLoopbackPort,
  runCommand,
  waitForHealth,
} from "./docker";
import { createScratch } from "./scratch";

const COMPOSE_FILE = path.join(REPOSITORY_ROOT, "docker-compose.yml");
const HOST_USER_ID = process.getuid?.() ?? 1000;
const HOST_GROUP_ID = process.getgid?.() ?? 1000;

const secretSentinel = plant("secret", `sk-smoke-${randomLetters(24)}`);
const sampleSentinel = plant("sample", `smokesample${randomLetters(20)}`);
const writingSample = `${sampleSentinel} Command fail.`;

// The Evaluation the seed writes, as the server answers it: the fake Judge's one Finding, scored
// and banded by Rubric Version 1, which new Evaluations record as provisional (ADR 0020, #87).
const expectedEvaluation = (id: string, sample: string) => {
  expect(sample.indexOf("fail")).not.toBe(-1);
  const byteStart = new TextEncoder().encode(
    sample.slice(0, sample.indexOf("fail"))
  ).length;
  return {
    band: "Natural",
    correctedText: sample.replace("fail", "fails"),
    evaluatedAt: "2026-09-08T12:00:00.000Z",
    evaluatedEnglishWordCount: 3,
    findings: [
      {
        byteEnd: byteStart + 4,
        byteStart,
        category: "Verb form/tense",
        correction: "fails",
        explanation: "A singular subject needs a singular verb.",
        originalText: "fail",
        severity: "Minor",
      },
    ],
    id,
    model: "deterministic-docker-smoke-model",
    originalText: sample,
    provider: "test",
    rubricVersion: "1-provisional",
    score: 85,
    suggestions: [],
    summary: "One local agreement error.",
  };
};

const readJson = async (url: string): Promise<unknown> => {
  const response = await fetchResponse(url);
  expect(response.status).toBe(200);
  return response.json();
};

interface ComposeConfig {
  readonly services?: {
    readonly app?: { readonly ports?: unknown; readonly user?: unknown };
  };
}

// The state of one run. The checks run in order: the setup and the first checks build it, and the
// later checks read it.
let scratch = "";
let dataDirectory = "";
let hostPort = 0;
let baseUrl = "";
let releaseCompose: ReturnType<typeof composeOf> | undefined;
let compose: ReturnType<typeof composeOf> | undefined;
let evaluationId = "";
let seededEvaluation: unknown;

const running = () => {
  if (compose === undefined) {
    throw new Error("the smoke did not set up its Compose project");
  }
  return compose;
};

const listBrowserAssets = async () => {
  const listing = await running()([
    "exec",
    "-T",
    "app",
    "node",
    "-e",
    "const fs = require('node:fs'); for (const file of fs.readdirSync('../web/dist/assets', { recursive: true })) if (fs.statSync('../web/dist/assets/' + file).isFile()) process.stdout.write(file + '\\n');",
  ]);
  return listing.stdout
    .split("\n")
    .map((file) => file.trim())
    .filter(Boolean);
};

beforeAll(async () => {
  scratch = await createScratch();
  dataDirectory = path.join(scratch, "data");
  await mkdir(dataDirectory);
  hostPort = await reserveLoopbackPort();
  baseUrl = `http://127.0.0.1:${hostPort}`;

  const envFile = path.join(scratch, "compose.env");
  const safeEnvironment = path.join(scratch, "safe-environment.yml");
  const runtime = path.join(scratch, "runtime.yml");
  const environment = `    environment:\n      OPENROUTER_API_KEY: "${secretSentinel}"\n      SERVER_PORT: "3000"\n`;
  await writeFile(
    envFile,
    `GRIFANDO_DATA_DIR=${dataDirectory}\nGRIFANDO_GID=${HOST_GROUP_ID}\nGRIFANDO_UID=${HOST_USER_ID}\n`
  );
  await writeFile(safeEnvironment, `services:\n  app:\n${environment}`);
  await writeFile(
    runtime,
    `services:\n  app:\n${environment}    ports: !override\n      - "127.0.0.1:${hostPort}:3000"\n`
  );

  const name = `grifando-smoke-${process.pid}-${randomLetters(6)}`;
  releaseCompose = composeOf({
    envFile,
    files: [COMPOSE_FILE, safeEnvironment],
    name,
  });
  compose = composeOf({ envFile, files: [COMPOSE_FILE, runtime], name });
});

afterAll(() => removeProject(compose, scratch));

describe("Docker smoke", () => {
  it("validates the release Compose boundary", async () => {
    if (releaseCompose === undefined) {
      throw new Error("the smoke did not set up its Compose project");
    }
    const config = await releaseCompose(["config", "--format", "json"]);
    const parsed = JSON.parse(config.stdout) as ComposeConfig;

    expect(parsed.services?.app?.ports).toStrictEqual([
      {
        host_ip: "127.0.0.1",
        mode: "ingress",
        protocol: "tcp",
        published: "3001",
        target: 3000,
      },
    ]);
    expect(parsed.services?.app?.user).toBe(`${HOST_USER_ID}:${HOST_GROUP_ID}`);
  });

  it("builds and starts the isolated application", async () => {
    const app = running();
    await app(["build", "app"]);
    await app(["up", "--detach", "--no-build", "app"]);
    await waitForHealth(baseUrl);

    const runtimeUser = await app([
      "exec",
      "-T",
      "app",
      "node",
      "-e",
      "process.stdout.write(String(process.getuid()) + ':' + String(process.getgid()))",
    ]);
    expect(runtimeUser.stdout.trim()).toBe(`${HOST_USER_ID}:${HOST_GROUP_ID}`);
    const image = await app(["config", "--images", "app"]);
    const imageUser = await runCommand("docker", [
      "image",
      "inspect",
      "--format",
      "{{.Config.User}}",
      image.stdout.trim(),
    ]);
    expect(imageUser.stdout.trim()).toBe("node");
    const toolFiles = await app([
      "exec",
      "-T",
      "app",
      "node",
      "-e",
      "const fs = require('node:fs'); process.stdout.write(JSON.stringify(['/app/.mcp.json', '/app/.codex', '/app/.scratch'].filter((file) => fs.existsSync(file))))",
    ]);
    expect(JSON.parse(toolFiles.stdout)).toStrictEqual([]);

    const publishedPort = await app(["port", "app", "3000"]);
    expect(publishedPort.stdout.trim()).toBe(`127.0.0.1:${hostPort}`);
    const nonLoopback = await probeNonLoopback(hostPort);
    expect(nonLoopback.addresses.length).toBeGreaterThan(0);
    expect(nonLoopback.answered).toStrictEqual([]);
    expect(await hostileHostStatus(hostPort)).toBe(403);
    const hostileOrigin = await fetchResponse(`${baseUrl}/api/evaluations`, {
      body: JSON.stringify({ writingSample }),
      headers: {
        "content-type": "application/json",
        origin: "https://hostile.example",
        "sec-fetch-site": "cross-site",
      },
      method: "POST",
    });
    expect(hostileOrigin.status).toBe(403);
  });

  // PGlite admits one process at a time, so the seed writes while no container holds the data.
  it("seeds deterministic retained evidence", async () => {
    const app = running();
    await app(["stop", "app"]);
    evaluationId = await seedDockerSmoke({
      dataDirectory: path.join(dataDirectory, "pglite"),
      writingSample,
    });
    await app(["start", "app"]);
    await waitForHealth(baseUrl);

    expect(evaluationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
    );
    seededEvaluation = await readJson(
      `${baseUrl}/api/evaluations/${evaluationId}`
    );
    expect(seededEvaluation).toStrictEqual(
      expectedEvaluation(evaluationId, writingSample)
    );
  });

  it("replaces the container and reopens its data directory", async () => {
    const app = running();
    const firstContainer = await app(["ps", "--quiet", "app"]);
    expect(firstContainer.stdout.trim()).not.toBe("");
    const cluster = path.join(dataDirectory, "pglite", "PG_VERSION");
    expect(existsSync(cluster)).toBe(true);
    const clusterBefore = statSync(cluster).ino;

    await app([
      "up",
      "--detach",
      "--force-recreate",
      "--no-build",
      "--no-deps",
      "app",
    ]);
    await waitForHealth(baseUrl);

    const replacementContainer = await app(["ps", "--quiet", "app"]);
    expect(replacementContainer.stdout.trim()).not.toBe(
      firstContainer.stdout.trim()
    );
    expect(statSync(cluster).ino).toBe(clusterBefore);
    expect(
      await readJson(`${baseUrl}/api/evaluations/${evaluationId}`)
    ).toStrictEqual(seededEvaluation);
  });

  it("scans browser assets and logs", async () => {
    const app = running();
    const index = await fetchResponse(baseUrl);
    expect(index.status).toBe(200);
    expect(
      leakedSentinels(new Uint8Array(await index.arrayBuffer()))
    ).toStrictEqual([]);

    const assets = await listBrowserAssets();
    expect(assets.length).toBeGreaterThan(0);
    const served = await Promise.all(
      assets.map(async (asset) => {
        const assetPath = asset
          .split("/")
          .map((part) => encodeURIComponent(part))
          .join("/");
        const response = await fetchResponse(`${baseUrl}/assets/${assetPath}`);
        return {
          asset,
          leaked: leakedSentinels(new Uint8Array(await response.arrayBuffer())),
          status: response.status,
        };
      })
    );
    expect(served).toStrictEqual(
      assets.map((asset) => ({ asset, leaked: [], status: 200 }))
    );

    // PE's expected status changed with ADR 0017 (the data location), ADR 0020 decision 5 (the
    // provisional Rubric Version), #273 (the local Trainer) and #347 (the OpenRouter key alone runs
    // the Trainer, OK-02). Phase 4 built it, so its rows are superseded under ADR 0021 and the check
    // stays here, pinned.
    const setup = await readJson(`${baseUrl}/api/setup`);
    expect(setup).toStrictEqual({
      configured: true,
      dataLocation: path.join(dataDirectory, "pglite"),
      model: "openai/gpt-5.6-terra",
      provider: "OpenRouter",
      rubricVersion: "1-provisional",
      trainer: {
        configured: true,
        model: "google/gemini-3.5-flash",
        provider: "OpenRouter",
      },
    });
    expect(leakedSentinels(JSON.stringify(setup))).toStrictEqual([]);

    const logs = await app(["logs", "--no-color", "app"]);
    expect(leakedSentinels(`${logs.stdout}${logs.stderr}`)).toStrictEqual([]);
  });
});
