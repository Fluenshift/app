// Ported from Grifando src/server/domain/mistakes/mistakePattern.repository.test.ts (74dbb9f):
// each case runs on a fresh PGlite database, for the local Learner.
import { rm } from "node:fs/promises";

import { MistakeCategory } from "@grifando/contract";
import { Effect } from "effect";
import type { Layer } from "effect";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { makeTemporaryDatabase } from "../test/database";
import { listPatterns, upsertPattern } from "./mistake-pattern-repository";

let database: Awaited<ReturnType<typeof makeTemporaryDatabase>>;

const run = <A, E>(
  effect: Effect.Effect<A, E, Layer.Success<typeof database.layer>>
) => Effect.runPromise(effect.pipe(Effect.provide(database.layer)));

beforeEach(async () => {
  database = await makeTemporaryDatabase();
});

afterEach(async () => {
  await rm(database.directory, { force: true, recursive: true });
});

describe("mistakePatternRepository.upsertPattern", () => {
  it("creates a new pattern on the first occurrence", async () => {
    const pattern = await run(
      upsertPattern({
        category: MistakeCategory.PREPOSITIONS,
        exampleCorrection: "I depend on this library.",
        exampleOriginal: "I depend of this library.",
        rawPatternKey: "Depend On",
      })
    );

    expect(pattern.patternKey).toBe("depend-on");
    expect(pattern.occurrenceCount).toBe(1);
    expect(pattern.masteryLevel).toBe("ACTIVE");
  });

  it("collapses repeated occurrences of the same concept into one growing pattern", async () => {
    await run(
      upsertPattern({
        category: MistakeCategory.PREPOSITIONS,
        exampleCorrection: "I depend on this library.",
        exampleOriginal: "I depend of this library.",
        rawPatternKey: "depend-on",
      })
    );

    const second = await run(
      upsertPattern({
        category: MistakeCategory.PREPOSITIONS,
        exampleCorrection: "This depends on the config.",
        exampleOriginal: "This depends of the config.",
        rawPatternKey: "Depend On!!",
      })
    );

    const patterns = await run(listPatterns());

    expect(patterns).toHaveLength(1);
    expect(second.occurrenceCount).toBe(2);
    expect(second.exampleOriginal).toBe("This depends of the config.");
    // Each occurrence in writing is a failed recall for the half-life model.
    expect(second.incorrectCount).toBe(2);
    expect(second.correctCount).toBe(0);
    expect(second.lastPracticedAt.getTime()).toBe(second.lastSeenAt.getTime());
  });

  it("keeps distinct categories as separate patterns even with the same raw key", async () => {
    await run(
      upsertPattern({
        category: MistakeCategory.PREPOSITIONS,
        exampleCorrection: "b",
        exampleOriginal: "a",
        rawPatternKey: "shared-key",
      })
    );
    await run(
      upsertPattern({
        category: MistakeCategory.VOCABULARY,
        exampleCorrection: "d",
        exampleOriginal: "c",
        rawPatternKey: "shared-key",
      })
    );

    const patterns = await run(listPatterns());
    expect(patterns).toHaveLength(2);
  });

  it("orders patterns by occurrence count, most frequent first", async () => {
    await run(
      upsertPattern({
        category: MistakeCategory.ARTICLES,
        exampleCorrection: "b",
        exampleOriginal: "a",
        rawPatternKey: "rare",
      })
    );
    await run(
      upsertPattern({
        category: MistakeCategory.PREPOSITIONS,
        exampleCorrection: "d",
        exampleOriginal: "c",
        rawPatternKey: "frequent",
      })
    );
    await run(
      upsertPattern({
        category: MistakeCategory.PREPOSITIONS,
        exampleCorrection: "f",
        exampleOriginal: "e",
        rawPatternKey: "frequent",
      })
    );

    const patterns = await run(listPatterns());
    expect(patterns[0]?.patternKey).toBe("frequent");
    expect(patterns[0]?.occurrenceCount).toBe(2);
  });
});
