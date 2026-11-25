// What the Academy asks of a Trainer model (docs/adr/0012). Ported from Grifando
// src/server/ai/provider.ts (74dbb9f). Grifando's writing analysis is not a Trainer call: the
// Judge evaluates every text, and the Trainer's Enrichment adds the Academy fields to the
// Findings (docs/adr/0004).
import type { GeneratedExercise, MistakeCategory } from "@grifando/contract";
import type { Effect } from "effect";

import type { ExplainAttemptInput } from "../prompts/answer-explanation";
import type { EnrichmentInput } from "../prompts/enrichment";
import type { ExerciseTarget } from "../prompts/exercise-generation";
import type { InterviewHistoryItem } from "../prompts/interview";
import type { TrainerError } from "./trainer-errors";

// Every result names the model that answered, the fallback's when the fallback did (Grifando
// #77).
export interface GeneratedExercises {
  readonly exercises: readonly GeneratedExercise[];
  readonly model: string;
}

export interface InterviewQuestion {
  readonly model: string;
  readonly question: string;
}

export interface AnswerExplanation {
  readonly explanation: string;
  readonly model: string;
}

// What the Enrichment adds to one Finding: its Mistake Category, which maps onto the Finding's
// Error Category (docs/adr/0005), a Pattern Key, the L1 Transfer flag and an example.
export interface FindingEnrichment {
  readonly category: MistakeCategory;
  readonly example: string;
  readonly l1Transfer: boolean;
  readonly patternKey: string;
}

// One span the Trainer finds correct but unnatural (docs/adr/0004): what a fluent speaker would
// write instead, why, an example, its Pattern Key and the L1 Transfer flag. Its Mistake Category
// is always UNNATURAL_PHRASING (docs/adr/0005).
export interface NaturalnessNote {
  readonly example: string;
  readonly explanation: string;
  readonly l1Transfer: boolean;
  readonly naturalSpan: string;
  readonly originalSpan: string;
  readonly patternKey: string;
}

// One FindingEnrichment per Finding of the input, in the same order, then the natural version of
// the whole Writing Sample and its Naturalness Notes, in the Trainer's order (docs/adr/0028).
export interface Enrichment {
  readonly findings: readonly FindingEnrichment[];
  readonly model: string;
  readonly naturalVersion: string;
  readonly naturalnessNotes: readonly NaturalnessNote[];
}

export interface TrainerMethods {
  readonly continueInterview: (
    history: readonly InterviewHistoryItem[]
  ) => Effect.Effect<InterviewQuestion, TrainerError>;
  readonly enrichFindings: (
    input: EnrichmentInput
  ) => Effect.Effect<Enrichment, TrainerError>;
  readonly explainAttempt: (
    input: ExplainAttemptInput
  ) => Effect.Effect<AnswerExplanation, TrainerError>;
  readonly generateExercises: (
    targets: readonly ExerciseTarget[]
  ) => Effect.Effect<GeneratedExercises, TrainerError>;
}
