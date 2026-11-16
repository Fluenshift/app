// What the Academy asks of a Trainer model (docs/adr/0012). Ported from Grifando
// src/server/ai/provider.ts (74dbb9f). Grifando's writing analysis is not a Trainer call: the
// Judge evaluates every text, and the Trainer's Enrichment adds the Academy fields to the
// Findings (docs/adr/0004).
import type { GeneratedExercise, MistakeCategory } from "@fluenshift/contract";
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

// One FindingEnrichment per Finding of the input, in the same order.
export interface Enrichment {
  readonly findings: readonly FindingEnrichment[];
  readonly model: string;
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
