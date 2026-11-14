// Typed stub for the red commit of #12: the ported tests compile and fail on their checks.
import type { AssessmentSpan } from "./model-assessment";

// One empty span, so no expected list can match yet, not even an empty one.
export const findProtectedTechnicalContent = (
  _writingSample: string
): readonly AssessmentSpan[] => [
  { byteEnd: -1, byteStart: -1, originalText: "" },
];
