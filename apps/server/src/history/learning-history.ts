// Learning History: the retained Evaluations of a Learner, ported from PE
// apps/server/src/history/learning-history.ts (5e831bb) onto the product schema. Every query is
// scoped by the Learner the request acts for (docs/adr/0003), and History keeps PE's order:
// newest first, then the latest insertion, as SQLite's rowid ordered them.
import type {
  ErrorCategory,
  FindingSeverity,
  ProficiencyBand,
  WritingSampleOrigin,
} from "@fluenshift/contract";
import {
  Database,
  evaluations,
  findings,
  learners,
  suggestions,
} from "@fluenshift/db";
import { and, asc, desc, eq } from "drizzle-orm";
import { Effect } from "effect";

import { CurrentLearner } from "../learner-identity";

export interface EvaluationFinding {
  readonly byteEnd: number;
  readonly byteStart: number;
  readonly category: ErrorCategory;
  readonly correction: string;
  readonly explanation: string;
  readonly originalText: string;
  readonly severity: FindingSeverity;
}

export interface EvaluationSuggestion {
  readonly alternative?: string;
  readonly byteEnd: number;
  readonly byteStart: number;
  readonly explanation: string;
  readonly originalText: string;
}

export interface Evaluation {
  readonly band: ProficiencyBand;
  readonly correctedText: string;
  readonly evaluatedAt: string;
  readonly evaluatedEnglishWordCount: number;
  readonly findings: readonly EvaluationFinding[];
  readonly id: string;
  readonly model: string;
  readonly originalText: string;
  readonly provider: string;
  readonly rubricVersion: string;
  readonly score: number;
  readonly suggestions: readonly EvaluationSuggestion[];
  readonly summary: string;
}

export type EvaluationSummary = Pick<
  Evaluation,
  "band" | "evaluatedAt" | "id" | "rubricVersion" | "score" | "summary"
>;

export interface PersistEvaluationInput {
  readonly contentHash: string;
  readonly evaluation: Evaluation;
  readonly inputTokens?: number;
  readonly latencyMilliseconds: number;
  readonly origin?: WritingSampleOrigin;
  readonly outputTokens?: number;
  readonly submittedAt: string;
}

const toEvaluation = (
  row: typeof evaluations.$inferSelect,
  findingRows: readonly (typeof findings.$inferSelect)[],
  suggestionRows: readonly (typeof suggestions.$inferSelect)[]
): Evaluation => ({
  band: row.band as ProficiencyBand,
  correctedText: row.correctedText,
  evaluatedAt: row.evaluatedAt.toISOString(),
  evaluatedEnglishWordCount: row.evaluatedEnglishWordCount,
  findings: findingRows.map((finding) => ({
    byteEnd: finding.byteEnd,
    byteStart: finding.byteStart,
    category: finding.category as ErrorCategory,
    correction: finding.correction,
    explanation: finding.explanation,
    originalText: finding.originalText,
    severity: finding.severity as FindingSeverity,
  })),
  id: row.id,
  model: row.model,
  originalText: row.originalText,
  provider: row.provider,
  rubricVersion: row.rubricVersion,
  score: row.score,
  suggestions: suggestionRows.map((suggestion) => ({
    ...(suggestion.alternative === null
      ? {}
      : { alternative: suggestion.alternative }),
    byteEnd: suggestion.byteEnd,
    byteStart: suggestion.byteStart,
    explanation: suggestion.explanation,
    originalText: suggestion.originalText,
  })),
  summary: row.summary,
});

export const persistEvaluation = Effect.fn("LearningHistory.persistEvaluation")(
  function* ({
    contentHash,
    evaluation,
    inputTokens,
    latencyMilliseconds,
    origin = "work",
    outputTokens,
    submittedAt,
  }: PersistEvaluationInput) {
    const database = yield* Database;
    const learner = yield* CurrentLearner;
    yield* database.run((client) =>
      client.transaction((transaction) =>
        transaction
          .insert(learners)
          .values({ id: learner.id })
          .onConflictDoNothing()
          .then(() =>
            transaction.insert(evaluations).values({
              band: evaluation.band,
              contentHash,
              correctedText: evaluation.correctedText,
              evaluatedAt: new Date(evaluation.evaluatedAt),
              evaluatedEnglishWordCount: evaluation.evaluatedEnglishWordCount,
              id: evaluation.id,
              inputTokens,
              latencyMilliseconds,
              learnerId: learner.id,
              model: evaluation.model,
              origin,
              originalText: evaluation.originalText,
              outputTokens,
              provider: evaluation.provider,
              rubricVersion: evaluation.rubricVersion,
              score: evaluation.score,
              submittedAt: new Date(submittedAt),
              summary: evaluation.summary,
            })
          )
          .then(() =>
            evaluation.findings.length > 0
              ? transaction.insert(findings).values(
                  evaluation.findings.map((finding, position) => ({
                    ...finding,
                    evaluationId: evaluation.id,
                    learnerId: learner.id,
                    position,
                  }))
                )
              : undefined
          )
          .then(() =>
            evaluation.suggestions.length > 0
              ? transaction.insert(suggestions).values(
                  evaluation.suggestions.map((suggestion, position) => ({
                    alternative: suggestion.alternative,
                    byteEnd: suggestion.byteEnd,
                    byteStart: suggestion.byteStart,
                    evaluationId: evaluation.id,
                    explanation: suggestion.explanation,
                    learnerId: learner.id,
                    originalText: suggestion.originalText,
                    position,
                  }))
                )
              : undefined
          )
      )
    );
  }
);

export interface ListEvaluationsOptions {
  // Only the Evaluations of Writing Samples of this origin; every origin when absent.
  readonly origin?: WritingSampleOrigin;
}

export const listEvaluations = Effect.fn("LearningHistory.listEvaluations")(
  function* (options: ListEvaluationsOptions = {}) {
    const database = yield* Database;
    const learner = yield* CurrentLearner;
    const rows = yield* database.run((client) =>
      client
        .select({
          band: evaluations.band,
          evaluatedAt: evaluations.evaluatedAt,
          id: evaluations.id,
          rubricVersion: evaluations.rubricVersion,
          score: evaluations.score,
          summary: evaluations.summary,
        })
        .from(evaluations)
        .where(
          and(
            eq(evaluations.learnerId, learner.id),
            options.origin === undefined
              ? undefined
              : eq(evaluations.origin, options.origin)
          )
        )
        .orderBy(
          desc(evaluations.evaluatedAt),
          desc(evaluations.insertionOrder)
        )
    );
    return rows.map((row): EvaluationSummary => ({
      ...row,
      band: row.band as ProficiencyBand,
      evaluatedAt: row.evaluatedAt.toISOString(),
    }));
  }
);

export const getEvaluation = Effect.fn("LearningHistory.getEvaluation")(
  function* (evaluationId: string) {
    const database = yield* Database;
    const learner = yield* CurrentLearner;
    // One snapshot, so a deletion between the reads cannot leave an Evaluation half read.
    return yield* database.run((client) =>
      client.transaction(
        (transaction) =>
          transaction
            .select()
            .from(evaluations)
            .where(
              and(
                eq(evaluations.id, evaluationId),
                eq(evaluations.learnerId, learner.id)
              )
            )
            .then(([row]) =>
              row === undefined
                ? null
                : Promise.all([
                    transaction
                      .select()
                      .from(findings)
                      .where(
                        and(
                          eq(findings.evaluationId, evaluationId),
                          eq(findings.learnerId, learner.id)
                        )
                      )
                      .orderBy(asc(findings.position)),
                    transaction
                      .select()
                      .from(suggestions)
                      .where(
                        and(
                          eq(suggestions.evaluationId, evaluationId),
                          eq(suggestions.learnerId, learner.id)
                        )
                      )
                      .orderBy(asc(suggestions.position)),
                  ]).then(([findingRows, suggestionRows]) =>
                    toEvaluation(row, findingRows, suggestionRows)
                  )
            ),
        { isolationLevel: "repeatable read" }
      )
    );
  }
);

export const deleteEvaluation = Effect.fn("LearningHistory.deleteEvaluation")(
  function* (evaluationId: string) {
    const database = yield* Database;
    const learner = yield* CurrentLearner;
    yield* database.run((client) =>
      client
        .delete(evaluations)
        .where(
          and(
            eq(evaluations.id, evaluationId),
            eq(evaluations.learnerId, learner.id)
          )
        )
    );
  }
);
