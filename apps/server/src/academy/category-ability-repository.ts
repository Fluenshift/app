// The Learner's Category Abilities, the Elo-style estimates that aim each Exercise at about 70%
// expected success. Ported from Grifando
// src/server/domain/exercises/categoryAbility.repository.ts (74dbb9f).
import { randomUUID } from "node:crypto";

import type { MistakeCategory } from "@fluenshift/contract";
import { categoryAbilities, Database } from "@fluenshift/db";
import { eq, sql } from "drizzle-orm";
import { Effect } from "effect";

import { CurrentLearner } from "../learner-identity";

// Ratings by category; categories never practiced are absent (callers use DEFAULT_ABILITY).
export const getRatings = Effect.fn("CategoryAbilityRepository.getRatings")(
  function* () {
    const database = yield* Database;
    const learner = yield* CurrentLearner;
    const rows = yield* database.run((client) =>
      client
        .select()
        .from(categoryAbilities)
        .where(eq(categoryAbilities.learnerId, learner.id))
    );
    return new Map(
      rows.map((row) => [row.category as MistakeCategory, row.rating])
    );
  }
);

export const setRating = Effect.fn("CategoryAbilityRepository.setRating")(
  function* (category: MistakeCategory, rating: number) {
    const database = yield* Database;
    const learner = yield* CurrentLearner;
    yield* database.run((client) =>
      client
        .insert(categoryAbilities)
        .values({
          attemptCount: 1,
          category,
          id: randomUUID(),
          learnerId: learner.id,
          rating,
        })
        .onConflictDoUpdate({
          set: {
            attemptCount: sql`${categoryAbilities.attemptCount} + 1`,
            rating,
            updatedAt: new Date(),
          },
          target: [categoryAbilities.learnerId, categoryAbilities.category],
        })
    );
  }
);
