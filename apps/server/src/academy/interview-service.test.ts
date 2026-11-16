// Ported from Grifando src/server/domain/interview/interviewService.test.ts (74dbb9f) under
// docs/adr/0010, with the characterization of its follow-up history. Each answer is a practice
// Writing Sample that the Judge evaluates: the caller hands the interview that evaluation, which
// these cases fake by storing an Evaluation of the answer. The AI provider becomes a fake Trainer,
// and each case runs on a fresh PGlite database for the local Learner.
import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";

import type { LearnerId } from "@fluenshift/contract";
import { Database, learners } from "@fluenshift/db";
import type { DrizzleClient } from "@fluenshift/db";
import { Effect, Schema } from "effect";
import type { Layer } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  deleteEvaluation,
  persistEvaluation,
} from "../history/learning-history";
import type { Evaluation } from "../history/learning-history";
import { CurrentLearner } from "../learner-identity";
import { makeTemporaryDatabase } from "../test/database";
import { NotFoundError } from "./errors";
import {
  answerTurn,
  endInterview,
  getSession,
  startInterview,
} from "./interview-service";
import type { TrainerMethods } from "./trainer/trainer-model";

let database: Awaited<ReturnType<typeof makeTemporaryDatabase>>;

type Services = Layer.Success<typeof database.layer>;

const run = <A, E>(effect: Effect.Effect<A, E, Services>) =>
  Effect.runPromise(effect.pipe(Effect.provide(database.layer)));

// The same effect, acting for another Learner.
const runAs = <A, E>(
  learnerId: string,
  effect: Effect.Effect<A, E, Services>
) =>
  Effect.runPromise(
    effect.pipe(
      Effect.provideService(
        CurrentLearner,
        CurrentLearner.of({ id: learnerId as LearnerId })
      ),
      Effect.provide(database.layer)
    )
  );

const query = <A>(read: (client: DrizzleClient) => Promise<A>) =>
  run(
    Effect.gen(function* () {
      const service = yield* Database;
      return yield* service.run(read);
    })
  );

beforeEach(async () => {
  database = await makeTemporaryDatabase();
});

afterEach(async () => {
  await rm(database.directory, { force: true, recursive: true });
});

// The Judge's Evaluation of one answer: stored as a practice Writing Sample with no Findings.
const evaluated = (answer: string) => {
  const evaluation: Evaluation = {
    band: "Natural",
    correctedText: answer,
    evaluatedAt: "2026-11-16T12:00:00.000Z",
    evaluatedEnglishWordCount: 5,
    findings: [],
    id: randomUUID(),
    model: "judge-model",
    originalText: answer,
    provider: "openrouter",
    rubricVersion: "1",
    score: 95,
    suggestions: [],
    summary: "Clear and professional.",
  };
  return persistEvaluation({
    contentHash: "hash",
    evaluation,
    latencyMilliseconds: 1,
    origin: "practice",
    submittedAt: evaluation.evaluatedAt,
  }).pipe(Effect.as(evaluation));
};

class JudgeFailure extends Schema.TaggedError<
  JudgeFailure,
  { readonly brand: unique symbol }
>()("JudgeFailure", {}) {}

const evaluating = () => vi.fn(evaluated);

const asking = (...questions: readonly string[]) => {
  const ask = vi.fn<TrainerMethods["continueInterview"]>();
  for (const question of questions) {
    ask.mockReturnValueOnce(Effect.succeed({ model: "test-model", question }));
  }
  return ask.mockReturnValue(
    Effect.succeed({
      model: "test-model",
      question: "What did you work on recently?",
    })
  );
};

const fakeTrainer = (answers: Partial<TrainerMethods> = {}) => ({
  continueInterview: asking(),
  enrichFindings: vi.fn<TrainerMethods["enrichFindings"]>(),
  explainAttempt: vi.fn<TrainerMethods["explainAttempt"]>(),
  generateExercises: vi.fn<TrainerMethods["generateExercises"]>(),
  ...answers,
});

const sessionOf = (sessionId: string) =>
  run(getSession(sessionId)).then((session) => {
    if (session === null) {
      throw new Error("Expected the session");
    }
    return session;
  });

describe("interviewService.startInterview", () => {
  it("creates a session with one opening question", async () => {
    const { sessionId, turn } = await run(startInterview(fakeTrainer()));

    expect(turn.order).toBe(0);
    expect(turn.question).toBe("What did you work on recently?");

    const session = await sessionOf(sessionId);
    expect(session.status).toBe("ACTIVE");
  });
});

describe("interviewService.answerTurn", () => {
  it("evaluates the answer as a practice Writing Sample and asks a follow-up", async () => {
    const trainer = fakeTrainer();
    const evaluate = evaluating();
    const { sessionId, turn } = await run(startInterview(trainer));

    const result = await run(
      answerTurn(evaluate, trainer, {
        answer: "I worked on a payments API.",
        sessionId,
        turnId: turn.id,
      })
    );

    expect(result.status).toBe("answered");
    expect(evaluate).toHaveBeenCalledOnce();
    // The opening question and the follow-up.
    expect(trainer.continueInterview).toHaveBeenCalledTimes(2);

    const session = await sessionOf(sessionId);
    expect(session.turns).toHaveLength(2);
    expect(session.turns[0]?.answer).toBe("I worked on a payments API.");
    expect(session.turns[0]?.evaluationId).not.toBeNull();
  });

  it("ends the session instead of asking another question once the turn cap is reached", async () => {
    const trainer = fakeTrainer();
    const evaluate = evaluating();
    const { sessionId, turn } = await run(startInterview(trainer));

    // MAX_TURNS is 6 (0-indexed orders 0-5); answering order 5 should end it.
    const answerFrom = (
      turnId: string,
      index: number
    ): Promise<string | undefined> =>
      run(
        answerTurn(evaluate, trainer, {
          answer: `answer ${index}`,
          sessionId,
          turnId,
        })
      ).then((result) =>
        result.status === "answered" && index < 5
          ? answerFrom(result.nextTurn.id, index + 1)
          : result.status
      );

    const lastStatus = await answerFrom(turn.id, 0);

    expect(lastStatus).toBe("ended");

    const session = await sessionOf(sessionId);
    expect(session.status).toBe("ENDED");
  });

  it("fails and does not create a follow-up question when the Evaluation fails", async () => {
    const trainer = fakeTrainer();
    const evaluate = vi.fn(() => Effect.fail(new JudgeFailure()));
    const { sessionId, turn } = await run(startInterview(trainer));

    await expect(
      run(
        answerTurn(evaluate, trainer, {
          answer: "some answer",
          sessionId,
          turnId: turn.id,
        })
      )
    ).rejects.toBeInstanceOf(JudgeFailure);

    const session = await sessionOf(sessionId);
    expect(session.turns).toHaveLength(1);
    expect(session.turns[0]?.answer).toBeNull();
  });

  it("records the model that asked each question", async () => {
    const trainer = fakeTrainer({
      continueInterview: vi
        .fn<TrainerMethods["continueInterview"]>()
        .mockReturnValueOnce(
          Effect.succeed({ model: "primary-model", question: "Opening?" })
        )
        .mockReturnValueOnce(
          Effect.succeed({ model: "fallback-model", question: "Follow-up?" })
        ),
    });
    const { sessionId, turn } = await run(startInterview(trainer));

    await run(
      answerTurn(evaluating(), trainer, {
        answer: "An answer.",
        sessionId,
        turnId: turn.id,
      })
    );

    const session = await sessionOf(sessionId);
    expect(session.turns.map((each) => each.model)).toStrictEqual([
      "primary-model",
      "fallback-model",
    ]);
  });

  it("keeps a turn answered but forgets its answer once its Evaluation is deleted", async () => {
    const trainer = fakeTrainer();
    const { sessionId, turn } = await run(startInterview(trainer));
    const result = await run(
      answerTurn(evaluating(), trainer, {
        answer: "I worked on a payments API.",
        sessionId,
        turnId: turn.id,
      })
    );

    await run(deleteEvaluation(result.evaluation.id));

    const session = await sessionOf(sessionId);
    expect(session.turns[0]?.answer).toBeNull();
    expect(session.turns[0]?.evaluationId).toBeNull();
    expect(session.turns[0]?.answeredAt).toBeInstanceOf(Date);
    expect(session.turns).toHaveLength(2);
  });
});

describe("interviewService.answerTurn history", () => {
  it("asks each follow-up with every answered turn so far, in order", async () => {
    const continueInterview = asking(
      "What did you work on recently?",
      "What was the hardest part?",
      "What would you change?"
    );
    const trainer = fakeTrainer({ continueInterview });
    const evaluate = evaluating();
    const { sessionId, turn } = await run(startInterview(trainer));

    const first = await run(
      answerTurn(evaluate, trainer, {
        answer: "A payments API.",
        sessionId,
        turnId: turn.id,
      })
    );
    if (first.status !== "answered") {
      throw new Error("expected answered result");
    }
    await run(
      answerTurn(evaluate, trainer, {
        answer: "The retries.",
        sessionId,
        turnId: first.nextTurn.id,
      })
    );

    expect(continueInterview.mock.calls).toEqual([
      [[]],
      [
        [
          {
            answer: "A payments API.",
            question: "What did you work on recently?",
          },
        ],
      ],
      [
        [
          {
            answer: "A payments API.",
            question: "What did you work on recently?",
          },
          { answer: "The retries.", question: "What was the hardest part?" },
        ],
      ],
    ]);
  });
});

describe("interview ownership", () => {
  it("hides, refuses to answer and refuses to end another user's session", async () => {
    const trainer = fakeTrainer();
    const evaluate = evaluating();
    const { sessionId, turn } = await run(startInterview(trainer));
    await query((client) => client.insert(learners).values({ id: "intruder" }));

    expect(await runAs("intruder", getSession(sessionId))).toBeNull();
    await expect(
      runAs(
        "intruder",
        answerTurn(evaluate, trainer, {
          answer: "hijack",
          sessionId,
          turnId: turn.id,
        })
      )
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(await runAs("intruder", endInterview(sessionId))).toBe(false);

    expect(evaluate).not.toHaveBeenCalled();
    const session = await sessionOf(sessionId);
    expect(session.status).not.toBe("ENDED");
    expect(session.turns).toHaveLength(1);
    expect(session.turns[0]?.answer).toBeNull();
    expect(await run(endInterview(sessionId))).toBe(true);
  });
});
