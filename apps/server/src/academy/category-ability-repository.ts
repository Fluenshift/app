// The Learner's Category Abilities, the Elo-style estimates that aim each Exercise at about 70%
// expected success. Ported from Grifando
// src/server/domain/exercises/categoryAbility.repository.ts (74dbb9f).
import { randomUUID } from "node:crypto";

import type { MistakeCategory } from "@grifando/contract";
import { categoryAbilities, Database } from "@grifando/db";
import { eq, sql } from "drizzle-orm";
import { Effect } from "effect";

import { CurrentLearner } from "../learner-identity";

// Abilities by category; categories never practiced are absent (callers use DEFAULT_ABILITY).
export const getCategoryAbilities = Effect.fn(
  "CategoryAbilityRepository.getCategoryAbilities"
)(function* () {
  const database = yield* Database;
  const learner = yield* CurrentLearner;
  const rows = yield* database.run((client) =>
    client
      .select()
      .from(categoryAbilities)
      .where(eq(categoryAbilities.learnerId, learner.id))
  );
  return new Map(
    rows.map((row) => [row.category as MistakeCategory, row.ability])
  );
});

export const setCategoryAbility = Effect.fn(
  "CategoryAbilityRepository.setCategoryAbility"
)(function* (category: MistakeCategory, ability: number) {
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
        ability,
      })
      .onConflictDoUpdate({
        set: {
          attemptCount: sql`${categoryAbilities.attemptCount} + 1`,
          ability,
          updatedAt: new Date(),
        },
        target: [categoryAbilities.learnerId, categoryAbilities.category],
      })
  );
});
