// Ported from Grifando's characterization of its vocabulary routes (74dbb9f,
// migration/characterization/grifando/files/src/app/api/vocabulary), under docs/adr/0004 and
// docs/adr/0003: an item names its source Evaluation instead of a writing session, and carries
// no Learner id. The routes run on a fresh PGlite database, and a test header names the Learner,
// as a session would.
import { rm } from "node:fs/promises";

import type { LearnerId } from "@grifando/contract";
import { Effect, Layer, ManagedRuntime, Option } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../app";
import { LearnerIdentity } from "../learner-identity";
import { makeTemporaryDatabase } from "../test/database";
import {
  createVocabularyItem,
  deleteVocabularyItem,
} from "./vocabulary-repository";

const learnerFromHeader = Layer.succeed(
  LearnerIdentity,
  LearnerIdentity.of({
    identify: (request) =>
      Effect.succeed(
        (request.headers.get("x-test-learner") ?? "visitor-1") as LearnerId
      ),
  })
);

const runtimeFor = (
  temporary: Awaited<ReturnType<typeof makeTemporaryDatabase>>
) => ManagedRuntime.make(Layer.mergeAll(temporary.layer, learnerFromHeader));

let database: Awaited<ReturnType<typeof makeTemporaryDatabase>>;
let runtime: ReturnType<typeof runtimeFor>;

beforeEach(async () => {
  database = await makeTemporaryDatabase();
  runtime = runtimeFor(database);
});

afterEach(async () => {
  await runtime.dispose();
  await rm(database.directory, { force: true, recursive: true });
});

const appOf = () =>
  createApp({
    createVocabularyItem,
    deleteVocabularyItem,
    limits: {
      bodyMaxBytes: 256 * 1024,
      codeMaxCharacters: Option.none(),
      sampleMaxBytes: 32 * 1024,
      sampleMaxCharacters: Option.none(),
    },
    profile: "local",
    runtime,
    serveWeb: false,
    webDistPath: "unused",
  });

const json = (method: string, url: string, body?: unknown, learner?: string) =>
  new Request(`http://localhost${url}`, {
    headers: {
      "content-type": "application/json",
      ...(learner === undefined ? {} : { "x-test-learner": learner }),
    },
    method,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

const keys = (value: unknown) =>
  Object.keys(value as object)
    .toSorted()
    .join(", ");

const item = {
  exampleSentence: "I rely on the test suite.",
  meaningPt: "depender de",
  term: "rely on",
};

describe("vocabulary routes", () => {
  it("saves an item and answers 201 with it", async () => {
    const response = await appOf().request(
      json("POST", "/api/vocabulary", { ...item, term: "  rely on  " })
    );
    expect(response.status).toBe(201);
    const saved = (await response.json()) as Record<string, unknown>;
    expect(saved).toMatchObject({ ...item, sourceEvaluationId: null });
    expect(keys(saved)).toBe(
      "createdAt, exampleSentence, id, meaningPt, sourceEvaluationId, term"
    );
  });

  it("answers 400 with the validation issues for a missing field", async () => {
    const response = await appOf().request(
      json("POST", "/api/vocabulary", { term: "rely on" })
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "Invalid request body",
      issues: [expect.any(Object), expect.any(Object)],
    });
  });

  // Grifando's route read a body that is not JSON as null (src/app/api/vocabulary/route.ts,
  // 74dbb9f).
  it("refuses a body that is not JSON with the issue of a null body", async () => {
    const response = await appOf().request(
      new Request("http://localhost/api/vocabulary", {
        body: "{",
        headers: { "content-type": "application/json" },
        method: "POST",
      })
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid request body",
      issues: [{ message: "Expected object", path: [] }],
    });
  });

  it("deletes the visitor's item with 204, and 404s for an unknown or another user's item", async () => {
    const app = appOf();
    const created = await app.request(json("POST", "/api/vocabulary", item));
    const saved = (await created.json()) as { id: string };
    const foreign = await app.request(
      json("DELETE", `/api/vocabulary/${saved.id}`, undefined, "other-user")
    );
    const deleted = await app.request(
      json("DELETE", `/api/vocabulary/${saved.id}`)
    );
    const again = await app.request(
      json("DELETE", `/api/vocabulary/${saved.id}`)
    );

    expect([foreign.status, deleted.status, again.status]).toEqual([
      404, 204, 404,
    ]);
    expect(await deleted.text()).toBe("");
    expect(await again.json()).toEqual({ error: "Not found" });
  });
});
