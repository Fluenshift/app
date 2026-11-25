// Gate G6 for the hosted profile: builds the image, starts it in the hosted profile beside a
// Postgres 17 server with Docker Compose, and checks what Grifando's checklist after a deploy
// (`docs/deploy.md` §5 at the pin) checked without a browser: the session cookie of a new
// visitor, the CSP header, robots and sitemap (ADR 0043).
import { writeFile } from "node:fs/promises";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  composeOf,
  fetchResponse,
  randomLetters,
  removeProject,
  reserveLoopbackPort,
  waitForHealth,
} from "./docker";
import { hostedRuntime } from "./hosted-runtime";
import { createScratch } from "./scratch";

let scratch = "";
let baseUrl = "";
let compose: ReturnType<typeof composeOf> | undefined;

beforeAll(async () => {
  scratch = await createScratch();
  const hostPort = await reserveLoopbackPort();
  baseUrl = `http://127.0.0.1:${String(hostPort)}`;
  const envFile = path.join(scratch, "compose.env");
  const runtime = path.join(scratch, "hosted.yml");
  await writeFile(envFile, "");
  await writeFile(runtime, hostedRuntime(hostPort));
  compose = composeOf({
    envFile,
    files: [runtime],
    name: `grifando-hosted-smoke-${String(process.pid)}-${randomLetters(6)}`,
  });
  await compose(["up", "--detach", "--build", "app"]);
  await waitForHealth(baseUrl);
});

afterAll(() => removeProject(compose, scratch));

describe("Hosted Docker smoke", () => {
  it("gives a new visitor the session cookie", async () => {
    const response = await fetchResponse(`${baseUrl}/`);

    expect(response.status).toBe(200);
    expect(
      response.headers.getSetCookie().map((cookie) => cookie.split("=")[0])
    ).toContain("ig_session");
  });

  it("answers with the Content-Security-Policy header", async () => {
    const response = await fetchResponse(`${baseUrl}/`);

    expect(response.headers.has("content-security-policy")).toBe(true);
  });

  it("answers robots.txt and sitemap.xml", async () => {
    const answers = await Promise.all([
      fetchResponse(`${baseUrl}/robots.txt`),
      fetchResponse(`${baseUrl}/sitemap.xml`),
    ]);

    // The application shell answers 200 at any path, so the media type tells the files apart.
    expect(
      answers.map((answer) => [
        answer.status,
        answer.headers.get("content-type"),
      ])
    ).toStrictEqual([
      [200, "text/plain; charset=UTF-8"],
      [200, "application/xml"],
    ]);
  });
});
