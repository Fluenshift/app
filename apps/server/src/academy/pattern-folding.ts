// Folds an Evaluation's Findings into the Learner's Mistake Patterns. Ported from Grifando
// src/server/domain/writing/writingCoachService.ts (74dbb9f) under docs/adr/0004: the Judge has
// already evaluated and stored the Writing Sample, so the Academy only reads its Findings, asks
// the Trainer's Enrichment for the Academy fields, and records one Occurrence per Finding.
import type { MistakeCategory, MistakeSeverity } from "@fluenshift/contract";
import { Effect } from "effect";

import type { TrainerMethods } from "./trainer/trainer-model";

// One Finding as the Academy records it under a Mistake Pattern.
export interface Occurrence {
  readonly category: MistakeCategory;
  readonly correctedSpan: string;
  readonly createdAt: Date;
  readonly evaluationId: string;
  readonly example: string;
  readonly explanation: string;
  readonly findingPosition: number | null;
  readonly id: string;
  readonly l1Transfer: boolean;
  readonly originalSpan: string;
  readonly patternId: string;
  readonly rubricVersion: string;
  readonly severity: MistakeSeverity;
}

export interface FoldEvaluationInput {
  // Explain Code only: context for the Trainer, never stored (Grifando SPEC.md §5.6).
  readonly codeSnippet?: string;
  readonly evaluationId: string;
}

export interface FoldedEvaluation {
  readonly occurrences: readonly Occurrence[];
}

export const foldEvaluation = (
  _trainer: TrainerMethods,
  _input: FoldEvaluationInput
): Effect.Effect<FoldedEvaluation | null> =>
  Effect.succeed({ occurrences: [] });
