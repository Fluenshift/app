// What the Docker smoke needs besides its checks: commands, HTTP probes and sentinel scans.
// Ported from PE `scripts/docker-smoke.ts`, on Node instead of Bun.
import { spawn } from "node:child_process";
import { randomInt } from "node:crypto";
import { once } from "node:events";
import { request } from "node:http";
import type { IncomingMessage } from "node:http";
import { createServer } from "node:net";
import { networkInterfaces } from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { removeScratch } from "./scratch";

export const REPOSITORY_ROOT = path.resolve(import.meta.dirname, "..", "..");

const COMMAND_TIMEOUT_MS = 10 * 60 * 1000;
const HEALTH_TIMEOUT_MS = 90 * 1000;
const REQUEST_TIMEOUT_MS = 5000;

export interface CommandResult {
  readonly stderr: string;
  readonly stdout: string;
}

// The sentinels the smoke plants, by label. No diagnostic prints them, and a scan names them
// only by their label.
const sentinels = new Map<string, string>();

export const plant = (label: string, value: string): string => {
  sentinels.set(label, value);
  return value;
};

const redact = (text: string) => {
  let redacted = text;
  for (const value of sentinels.values()) {
    redacted = redacted.replaceAll(value, "[REDACTED]");
  }
  return redacted;
};

/** The labels of the planted sentinels that `value` contains. */
export const leakedSentinels = (value: string | Uint8Array): string[] => {
  const bytes = Buffer.from(value);
  return [...sentinels]
    .filter(([, sentinel]) => bytes.includes(Buffer.from(sentinel, "utf-8")))
    .map(([label]) => label);
};

/** Runs a command from the repository root and fails with its redacted output. */
export const runCommand = async (
  command: string,
  arguments_: readonly string[]
): Promise<CommandResult> => {
  const child = spawn(command, arguments_, { cwd: REPOSITORY_ROOT });
  let stderr = "";
  let stdout = "";
  let timedOut = false;
  child.stdout.setEncoding("utf-8");
  child.stderr.setEncoding("utf-8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });
  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill("SIGTERM");
  }, COMMAND_TIMEOUT_MS);

  try {
    const [code] = (await once(child, "close")) as [number | null];
    if (timedOut) {
      throw new Error(`${command} timed out`);
    }
    if (code !== 0) {
      const diagnostic = redact((stderr || stdout).trim()).slice(-4000);
      throw new Error(
        `${command} exited with ${String(code)}${diagnostic ? `: ${diagnostic}` : ""}`
      );
    }
    return { stderr, stdout };
  } finally {
    clearTimeout(timeout);
  }
};

/** Docker Compose for one project, its interpolation variables and its files. */
export const composeOf =
  (project: {
    readonly envFile: string;
    readonly files: readonly string[];
    readonly name: string;
  }) =>
  (arguments_: readonly string[]) =>
    runCommand("docker", [
      "compose",
      "--project-name",
      project.name,
      "--env-file",
      project.envFile,
      ...project.files.flatMap((file) => ["--file", file]),
      ...arguments_,
    ]);

export const reserveLoopbackPort = async (): Promise<number> => {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("the reserved port has no address");
  }
  const closed = once(server, "close");
  server.close();
  await closed;
  return address.port;
};

export const fetchResponse = (url: string, init?: RequestInit) =>
  fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });

export const waitForHealth = async (
  baseUrl: string,
  deadline = Date.now() + HEALTH_TIMEOUT_MS
): Promise<void> => {
  if (Date.now() >= deadline) {
    throw new Error("container health endpoint did not become ready");
  }
  try {
    const response = await fetchResponse(`${baseUrl}/api/health`);
    if (response.ok) {
      return;
    }
  } catch {
    // The container is still starting.
  }
  await sleep(500);
  return waitForHealth(baseUrl, deadline);
};

/** The status of a health check that names a foreign Host, which `fetch` cannot send. */
export const hostileHostStatus = async (port: number): Promise<number> => {
  const clientRequest = request({
    headers: { host: "hostile.example" },
    hostname: "127.0.0.1",
    method: "GET",
    path: "/api/health",
    port,
  });
  clientRequest.setTimeout(REQUEST_TIMEOUT_MS, () => {
    clientRequest.destroy(new Error("hostile Host probe timed out"));
  });
  const responded = once(clientRequest, "response");
  clientRequest.end();
  const [response] = (await responded) as [IncomingMessage];
  response.resume();
  await once(response, "end");
  return response.statusCode ?? 0;
};

/**
 * Tries the published port on every IPv4 address of this machine that is not loopback, and
 * returns the addresses tried and those that answered.
 */
export const probeNonLoopback = async (port: number) => {
  const addresses = Object.values(networkInterfaces())
    .flatMap((entries) => entries ?? [])
    .filter((entry) => entry.family === "IPv4" && !entry.internal)
    .map((entry) => entry.address);
  const answered = await Promise.all(
    addresses.map(async (address) => {
      try {
        await fetchResponse(`http://${address}:${port}/api/health`);
        return [address];
      } catch {
        // A refusal or a timeout is the loopback-only behavior.
        return [];
      }
    })
  );
  return { addresses, answered: answered.flat() };
};

/** Lowercase letters drawn without modulo bias, for names and throwaway secrets. */
export const randomLetters = (length: number) =>
  Array.from({ length }, () => String.fromCodePoint(97 + randomInt(26))).join(
    ""
  );

/** Removes a smoke's Compose project, its volumes and images, then its scratch directory. */
export const removeProject = async (
  compose: ReturnType<typeof composeOf> | undefined,
  scratch: string
) => {
  try {
    await compose?.([
      "down",
      "--volumes",
      "--remove-orphans",
      "--rmi",
      "local",
    ]);
  } finally {
    if (scratch !== "") {
      await removeScratch(scratch);
    }
  }
};
