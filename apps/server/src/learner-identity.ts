// Typed stub for the red commit: every request belongs to a Learner no test expects.
import type { LearnerId } from "@fluenshift/contract";
import { Context, Effect, Layer } from "effect";

export const LOCAL_LEARNER_ID = "" as LearnerId;

export class LearnerIdentity extends Context.Service<
  LearnerIdentity,
  { identify(request: Request): Effect.Effect<LearnerId> }
>()("server/LearnerIdentity") {
  static readonly local = Layer.succeed(
    LearnerIdentity,
    LearnerIdentity.of({
      identify: () => Effect.succeed("nobody" as LearnerId),
    })
  );
}
