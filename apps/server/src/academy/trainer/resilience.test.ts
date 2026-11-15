// Ported from Grifando src/server/ai/resilient.test.ts (74dbb9f), on Effect: a Trainer call is
// an Effect, an overloaded provider fails with TrainerUnavailableError, and the timeouts run on
// Effect's test clock, where a hanging call that outlives its timeout shows as not interrupted.
import { Cause, Effect, Exit, Fiber } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

import type { ExplainAttemptInput } from "../prompts/answer-explanation";
import { isOverloaded, withResilience } from "./resilience";
import {
  TrainerKeyRejectedError,
  TrainerQuotaExceededError,
  TrainerUnavailableError,
} from "./trainer-errors";
import type {
  AnswerExplanation,
  GeneratedExercises,
  TrainerMethods,
} from "./trainer-model";

type FakeProvider = { [K in keyof TrainerMethods]: Mock<TrainerMethods[K]> };

const fakeProvider = (): FakeProvider => ({
  continueInterview: vi.fn<TrainerMethods["continueInterview"]>(),
  explainAttempt: vi.fn<TrainerMethods["explainAttempt"]>(),
  generateExercises: vi.fn<TrainerMethods["generateExercises"]>(),
});

const overloaded = () => new TrainerUnavailableError();

const attemptInput: ExplainAttemptInput = {
  exercise: {
    acceptableAnswers: ["I depend on this library."],
    explanation: "'Depend' takes 'on'.",
    instruction: "Rewrite the sentence correctly.",
    original: "I depend of this library.",
    type: "REWRITE",
  },
  userAnswer: "I depend from this library.",
};

// A call that never answers, and records whether it was interrupted.
const hanging = <A>() => {
  const state = { interrupted: false };
  const call = Effect.never.pipe(
    Effect.onInterrupt(() =>
      Effect.sync(() => {
        state.interrupted = true;
      })
    )
  ) as Effect.Effect<A>;
  return { call, state };
};

describe("isOverloaded", () => {
  it("recognises overload shapes and rejects the rest", () => {
    expect(isOverloaded(new TrainerUnavailableError())).toBe(true);
    expect(isOverloaded(Object.assign(new Error("x"), { status: 503 }))).toBe(
      true
    );
    expect(isOverloaded(Object.assign(new Error("x"), { status: 529 }))).toBe(
      true
    );
    expect(
      isOverloaded(Object.assign(new Error("x"), { status: "UNAVAILABLE" }))
    ).toBe(true);
    expect(isOverloaded({ error: { type: "overloaded_error" } })).toBe(true);
    expect(isOverloaded(new TrainerKeyRejectedError())).toBe(false);
    expect(isOverloaded(new TrainerQuotaExceededError())).toBe(false);
    expect(isOverloaded(new Error("boom"))).toBe(false);
    expect(isOverloaded(null)).toBe(false);
  });
});

describe("withResilience", () => {
  it("retries once on the fallback when the primary is overloaded", async () => {
    const primary = fakeProvider();
    const fallback = fakeProvider();
    primary.generateExercises.mockReturnValue(Effect.fail(overloaded()));
    fallback.generateExercises.mockReturnValue(
      Effect.succeed({ exercises: [], model: "fallback-model" })
    );
    const wrapped = withResilience(primary, fallback, { timeout: 1000 });

    // The answer names the fallback model that gave it (Grifando #77).
    await expect(
      Effect.runPromise(wrapped.generateExercises([]))
    ).resolves.toEqual({ exercises: [], model: "fallback-model" });
    expect(primary.generateExercises).toHaveBeenCalledTimes(1);
    expect(fallback.generateExercises).toHaveBeenCalledTimes(1);
  });

  it("does not retry on a rejected key or exhausted quota", async () => {
    const cases = [
      new TrainerKeyRejectedError(),
      new TrainerQuotaExceededError(),
    ].map((error) => {
      const primary = fakeProvider();
      const fallback = fakeProvider();
      primary.continueInterview.mockReturnValue(Effect.fail(error));
      const wrapped = withResilience(primary, fallback, { timeout: 1000 });
      return {
        error,
        fallback,
        result: Effect.runPromise(wrapped.continueInterview([])),
      };
    });

    await Promise.all(
      cases.map(({ error, result }) => expect(result).rejects.toBe(error))
    );
    for (const { fallback } of cases) {
      expect(fallback.continueInterview).not.toHaveBeenCalled();
    }
  });

  it("times out a hanging call and then uses the fallback", async () => {
    const fromFallback: AnswerExplanation = {
      explanation: "From the fallback.",
      model: "fallback-model",
    };
    const primary = fakeProvider();
    const fallback = fakeProvider();
    const primaryCall = hanging<AnswerExplanation>();
    primary.explainAttempt.mockReturnValue(primaryCall.call);
    fallback.explainAttempt.mockReturnValue(Effect.succeed(fromFallback));
    const wrapped = withResilience(primary, fallback, {
      timeout: "60 seconds",
    });

    const exit = await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(
          wrapped.explainAttempt(attemptInput)
        );
        yield* TestClock.adjust("60 seconds");
        return yield* Effect.exit(Fiber.join(fiber));
      }).pipe(Effect.provide(TestClock.layer()))
    );

    expect(Exit.isSuccess(exit) ? exit.value : undefined).toBe(fromFallback);
    expect(primaryCall.state.interrupted).toBe(true);
  });

  it("throws AIProviderUnavailableError when both are overloaded", async () => {
    const primary = fakeProvider();
    const fallback = fakeProvider();
    primary.generateExercises.mockReturnValue(Effect.fail(overloaded()));
    fallback.generateExercises.mockReturnValue(Effect.fail(overloaded()));
    const wrapped = withResilience(primary, fallback, { timeout: 1000 });

    await expect(
      Effect.runPromise(wrapped.generateExercises([]))
    ).rejects.toBeInstanceOf(TrainerUnavailableError);
  });

  it("throws AIProviderUnavailableError, not the timeout error, when both time out", async () => {
    const primary = fakeProvider();
    const fallback = fakeProvider();
    const primaryCall = hanging<GeneratedExercises>();
    const fallbackCall = hanging<GeneratedExercises>();
    primary.generateExercises.mockReturnValue(primaryCall.call);
    fallback.generateExercises.mockReturnValue(fallbackCall.call);
    const wrapped = withResilience(primary, fallback, { timeout: 100 });

    const exit = await Effect.runPromise(
      Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(wrapped.generateExercises([]));
        yield* TestClock.adjust(200);
        return yield* Effect.exit(Fiber.join(fiber));
      }).pipe(Effect.provide(TestClock.layer()))
    );

    expect(
      Exit.isFailure(exit) ? Cause.squash(exit.cause) : undefined
    ).toBeInstanceOf(TrainerUnavailableError);
    expect([
      primaryCall.state.interrupted,
      fallbackCall.state.interrupted,
    ]).toStrictEqual([true, true]);
  });

  it("passes a non-overload error from the fallback through untouched", async () => {
    const primary = fakeProvider();
    const fallback = fakeProvider();
    const error = new TrainerKeyRejectedError();
    primary.generateExercises.mockReturnValue(Effect.fail(overloaded()));
    fallback.generateExercises.mockReturnValue(Effect.fail(error));
    const wrapped = withResilience(primary, fallback, { timeout: 1000 });

    await expect(Effect.runPromise(wrapped.generateExercises([]))).rejects.toBe(
      error
    );
  });
});
