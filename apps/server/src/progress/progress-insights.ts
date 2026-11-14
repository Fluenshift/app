// Typed stub for the red commit: every Progress is empty.
import type {
  ProgressEvidence,
  ProgressEvidenceSelection,
  ProgressPeriod,
  ProgressSummary,
} from "@fluenshift/contract";
import { Effect } from "effect";

export const getProgressSummary = Effect.fn(
  "ProgressInsights.getProgressSummary"
)(function* ({ period }: { readonly period: ProgressPeriod }, _now?: Date) {
  yield* Effect.void;
  const summary: ProgressSummary = {
    averageBand: null,
    averageScore: null,
    categoryDistributions: [],
    categoryRecurrences: [],
    evaluatedEnglishWordCount: 0,
    evaluationCount: 0,
    findingCount: 0,
    findingRate: null,
    incompatibleSegments: [],
    period,
    recurringCorrections: [],
    rubricVersion: "",
  };
  return summary;
});

export const getProgressEvidence = Effect.fn(
  "ProgressInsights.getProgressEvidence"
)(function* (
  {
    period,
    selection,
  }: {
    readonly period: ProgressPeriod;
    readonly selection: ProgressEvidenceSelection;
  },
  _now?: Date
) {
  yield* Effect.void;
  const evidence: ProgressEvidence = {
    evaluations: [],
    findings: [],
    period,
    rubricVersion: "",
    selection,
  };
  return evidence;
});
