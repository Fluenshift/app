import type { LearnerId } from "@fluenshift/contract";
import { SessionConfig } from "@fluenshift/env";
import { Context, Effect, Layer, Schema } from "effect";

/** The one implicit Learner of the local profile (docs/adr/0003). */
export const LOCAL_LEARNER_ID = "local" as LearnerId;

/**
 * A hosted request without a valid signed session cookie. Ported from Grifando
 * src/server/session/currentUser.ts (74dbb9f): the session gate refuses such an API request
 * before any route runs, so a route never meets one (docs/adr/0032).
 */
export class MissingSessionError extends Schema.TaggedError<
  MissingSessionError,
  { readonly brand: unique symbol }
>()("MissingSessionError", {}) {}

/**
 * Tells which Learner a request belongs to. Every stored row is scoped by that Learner. The
 * local profile has no session: every request is the implicit Learner. The hosted profile reads
 * the Learner from the signed session cookie.
 */
export class LearnerIdentity extends Context.Service<
  LearnerIdentity,
  {
    identify(request: Request): Effect.Effect<LearnerId, MissingSessionError>;
  }
>()("server/LearnerIdentity") {
  static readonly local = Layer.succeed(
    LearnerIdentity,
    LearnerIdentity.of({
      identify: () => Effect.succeed(LOCAL_LEARNER_ID),
    })
  );

  /**
   * One Learner per signed session cookie, ported from getCurrentUserId in Grifando
   * src/server/session/currentUser.ts (74dbb9f): read-only, it never creates a row.
   */
  // Stub: every request is a placeholder Learner.
  static readonly hosted = Layer.effect(
    LearnerIdentity,
    Effect.gen(function* () {
      yield* SessionConfig;
      return LearnerIdentity.of({
        identify: () => Effect.succeed("placeholder" as LearnerId),
      });
    })
  );
}

/**
 * The Learner the current request acts for. Every History and Progress query is scoped by it;
 * the edge provides it from `LearnerIdentity`.
 */
export class CurrentLearner extends Context.Service<
  CurrentLearner,
  { readonly id: LearnerId }
>()("server/CurrentLearner") {
  /** The local profile acts for its one implicit Learner. */
  static readonly local = Layer.succeed(
    CurrentLearner,
    CurrentLearner.of({ id: LOCAL_LEARNER_ID })
  );
}
