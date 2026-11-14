import type { LearnerId } from "@fluenshift/contract";
import { Context, Effect, Layer } from "effect";

/** The one implicit Learner of the local profile (docs/adr/0003). */
export const LOCAL_LEARNER_ID = "local" as LearnerId;

/**
 * Tells which Learner a request belongs to. Every stored row is scoped by that Learner. The
 * local profile has no session: every request is the implicit Learner. The hosted profile adds
 * a layer that reads the signed session cookie (Phase 6).
 */
export class LearnerIdentity extends Context.Service<
  LearnerIdentity,
  { identify(request: Request): Effect.Effect<LearnerId> }
>()("server/LearnerIdentity") {
  static readonly local = Layer.succeed(
    LearnerIdentity,
    LearnerIdentity.of({
      identify: () => Effect.succeed(LOCAL_LEARNER_ID),
    })
  );
}
