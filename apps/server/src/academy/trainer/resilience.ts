import { Effect } from "effect";
import type { Duration } from "effect";

import type { TrainerMethods } from "./trainer-model";

export const isOverloaded = (_error: unknown): boolean => false;

const notPorted = () => Effect.die(new Error("not ported yet"));

export const withResilience = (
  _primary: TrainerMethods,
  _fallback: TrainerMethods,
  _options: { readonly timeout: Duration.Input }
): TrainerMethods => ({
  continueInterview: notPorted,
  explainAttempt: notPorted,
  generateExercises: notPorted,
});
