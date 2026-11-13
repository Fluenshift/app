// Typed stub for the red commit of #13: the ported tests compile and fail on their checks.
import type { ModelAssessment } from "./model-assessment";

export const localizeModelAssessment = (
  _writingSample: string,
  assessment: ModelAssessment
): ModelAssessment => ({ ...assessment, findings: [] });
