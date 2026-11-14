import { Schema } from "effect";

/**
 * Identifies the Learner every stored row belongs to (docs/adr/0003). The local profile has
 * one implicit Learner; the hosted profile has one per anonymous session.
 */
export const LearnerId = Schema.String.check(
  Schema.isMinLength(1),
  Schema.isMaxLength(64)
).pipe(Schema.brand("LearnerId"));

export type LearnerId = typeof LearnerId.Type;
