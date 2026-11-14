// The view of a generated exercise that may reach the client, ported from Grifando
// src/server/domain/exercises/publicView.ts.
import type { GeneratedExercise } from "@fluenshift/contract";
import { absurd } from "effect";

export type PublicExercise =
  | { type: "MULTIPLE_CHOICE"; instruction: string; options: readonly string[] }
  | { type: "FILL_BLANK"; instruction: string; template: string }
  | { type: "REWRITE"; instruction: string; original: string }
  | { type: "TRANSLATION"; instruction: string; sourceText: string };

// Strips the answer and explanation from a generated exercise before it's sent to the client:
// active recall requires the answer never be revealed before an attempt (Grifando SPEC.md
// §5.4, "Active recall").
export const toPublicExercise = (
  exercise: GeneratedExercise
): PublicExercise => {
  switch (exercise.type) {
    case "MULTIPLE_CHOICE": {
      return {
        type: exercise.type,
        instruction: exercise.instruction,
        options: exercise.options,
      };
    }
    case "FILL_BLANK": {
      return {
        type: exercise.type,
        instruction: exercise.instruction,
        template: exercise.template,
      };
    }
    case "REWRITE": {
      return {
        type: exercise.type,
        instruction: exercise.instruction,
        original: exercise.original,
      };
    }
    case "TRANSLATION": {
      return {
        type: exercise.type,
        instruction: exercise.instruction,
        sourceText: exercise.sourceText,
      };
    }
    // Lint requires a default; the cases above are exhaustive, so it cannot be reached.
    default: {
      return absurd(exercise);
    }
  }
};
