// The interview: the Trainer asks questions and follow-ups, and the Judge evaluates each answer
// as a practice Writing Sample (docs/adr/0010). Ported from Grifando
// src/server/domain/interview/interviewService.ts and interview.repository.ts (74dbb9f). A turn
// keeps no copy of its answer: it reads the answer through its Evaluation, so deleting that
// Evaluation forgets the answer while the turn stays answered (DATA-POLICY.md § Deletion).
import { randomUUID } from "node:crypto";

import type { InterviewStatus } from "@fluenshift/contract";
import {
  Database,
  evaluations,
  interviewSessions,
  interviewTurns,
  learners,
} from "@fluenshift/db";
import { and, asc, eq } from "drizzle-orm";
import { Effect } from "effect";

import { CurrentLearner } from "../learner-identity";
import { NotFoundError } from "./errors";
import type { TrainerMethods } from "./trainer/trainer-model";

// An interview asks at most six questions, orders 0 to 5.
const MAX_TURNS = 6;

export interface InterviewTurn {
  // Read from the turn's Evaluation: null until the turn is answered, and again once that
  // Evaluation is deleted (DATA-POLICY.md § Deletion).
  readonly answer: string | null;
  readonly answeredAt: Date | null;
  readonly evaluationId: string | null;
  readonly id: string;
  // The Trainer model that asked the question (docs/adr/0012).
  readonly model: string;
  readonly order: number;
  readonly question: string;
}

export interface InterviewSession {
  readonly createdAt: Date;
  readonly id: string;
  readonly status: InterviewStatus;
  readonly turns: readonly InterviewTurn[];
}

export interface AnswerTurnInput {
  readonly answer: string;
  readonly sessionId: string;
  readonly turnId: string;
}

export interface NextTurn {
  readonly id: string;
  readonly order: number;
  readonly question: string;
}

export type AnswerTurnResult<Answered> =
  | {
      readonly evaluation: Answered;
      readonly nextTurn: NextTurn;
      readonly status: "answered";
    }
  | { readonly evaluation: Answered; readonly status: "ended" };

const toTurn = (
  row: typeof interviewTurns.$inferSelect,
  answer: string | null
): InterviewTurn => ({
  answer,
  answeredAt: row.answeredAt,
  evaluationId: row.evaluationId,
  id: row.id,
  model: row.model,
  order: row.order,
  question: row.question,
});

const createTurn = Effect.fn("InterviewService.createTurn")(function* (input: {
  readonly model: string;
  readonly order: number;
  readonly question: string;
  readonly sessionId: string;
}) {
  const database = yield* Database;
  const learner = yield* CurrentLearner;
  const [row] = yield* database.run((client) =>
    client
      .insert(interviewTurns)
      .values({
        id: randomUUID(),
        interviewSessionId: input.sessionId,
        learnerId: learner.id,
        model: input.model,
        order: input.order,
        question: input.question,
      })
      .returning()
  );
  if (row === undefined) {
    return yield* Effect.die(
      new Error("The insert returned no interview turn")
    );
  }
  return toTurn(row, null);
});

// Opens a session and asks the first question: the same Trainer call as every follow-up, with
// an empty history. The interview may be the Learner's first stored row, so the Learner is
// recorded first, as every repository that starts a Learner's data does.
export const startInterview = Effect.fn("InterviewService.startInterview")(
  function* (trainer: TrainerMethods) {
    const database = yield* Database;
    const learner = yield* CurrentLearner;
    const sessionId = randomUUID();
    yield* database.run((client) =>
      client.transaction((transaction) =>
        transaction
          .insert(learners)
          .values({ id: learner.id })
          .onConflictDoNothing()
          .then(() =>
            transaction
              .insert(interviewSessions)
              .values({ id: sessionId, learnerId: learner.id })
          )
      )
    );
    const { model, question } = yield* trainer.continueInterview([]);
    const turn = yield* createTurn({ model, order: 0, question, sessionId });
    return { sessionId, turn };
  }
);

// The Learner's session with its turns in order, or null when it does not exist or belongs to
// another Learner. Each answer is read through the turn's Evaluation, of the same Learner.
export const getSession = Effect.fn("InterviewService.getSession")(function* (
  sessionId: string
) {
  const database = yield* Database;
  const learner = yield* CurrentLearner;
  const [session] = yield* database.run((client) =>
    client
      .select()
      .from(interviewSessions)
      .where(
        and(
          eq(interviewSessions.learnerId, learner.id),
          eq(interviewSessions.id, sessionId)
        )
      )
  );
  if (session === undefined) {
    return null;
  }
  const turns = yield* database.run((client) =>
    client
      .select({ answer: evaluations.originalText, turn: interviewTurns })
      .from(interviewTurns)
      .leftJoin(
        evaluations,
        and(
          eq(evaluations.learnerId, interviewTurns.learnerId),
          eq(evaluations.id, interviewTurns.evaluationId)
        )
      )
      .where(
        and(
          eq(interviewTurns.learnerId, learner.id),
          eq(interviewTurns.interviewSessionId, sessionId)
        )
      )
      .orderBy(asc(interviewTurns.order))
  );
  const found: InterviewSession = {
    createdAt: session.createdAt,
    id: session.id,
    status: session.status as InterviewStatus,
    turns: turns.map(({ answer, turn }) => toTurn(turn, answer)),
  };
  return found;
});

const markAnswered = Effect.fn("InterviewService.markAnswered")(function* (
  turnId: string,
  evaluationId: string
) {
  const database = yield* Database;
  const learner = yield* CurrentLearner;
  yield* database.run((client) =>
    client
      .update(interviewTurns)
      .set({ answeredAt: new Date(), evaluationId })
      .where(
        and(
          eq(interviewTurns.learnerId, learner.id),
          eq(interviewTurns.id, turnId)
        )
      )
  );
});

// True when the Learner's session exists; another Learner's session reads as missing.
export const endInterview = Effect.fn("InterviewService.endInterview")(
  function* (sessionId: string) {
    const database = yield* Database;
    const learner = yield* CurrentLearner;
    const ended = yield* database.run((client) =>
      client
        .update(interviewSessions)
        .set({ status: "ENDED" })
        .where(
          and(
            eq(interviewSessions.learnerId, learner.id),
            eq(interviewSessions.id, sessionId)
          )
        )
        .returning({ id: interviewSessions.id })
    );
    return ended.length > 0;
  }
);

// Answering a turn hands the answer to the Judge's evaluation, which the caller supplies, then
// asks a follow-up grounded in every answered turn so far. A failed evaluation records nothing.
export const answerTurn = Effect.fn("InterviewService.answerTurn")(function* <
  Answered extends { readonly id: string },
  E,
  R,
>(
  evaluate: (answer: string) => Effect.Effect<Answered, E, R>,
  trainer: TrainerMethods,
  input: AnswerTurnInput
) {
  const session = yield* getSession(input.sessionId);
  if (session === null) {
    return yield* new NotFoundError({ resource: "Interview session" });
  }
  const turn = session.turns.find((each) => each.id === input.turnId);
  if (turn === undefined) {
    return yield* new NotFoundError({ resource: "Interview turn" });
  }
  const evaluation = yield* evaluate(input.answer);
  yield* markAnswered(turn.id, evaluation.id);
  if (turn.order + 1 >= MAX_TURNS) {
    yield* endInterview(input.sessionId);
    const ended: AnswerTurnResult<Answered> = { evaluation, status: "ended" };
    return ended;
  }
  const history = [
    ...session.turns.flatMap((each) =>
      each.answer === null || each.answer === ""
        ? []
        : [{ answer: each.answer, question: each.question }]
    ),
    { answer: input.answer, question: turn.question },
  ];
  const next = yield* trainer.continueInterview(history);
  const nextTurn = yield* createTurn({
    model: next.model,
    order: turn.order + 1,
    question: next.question,
    sessionId: input.sessionId,
  });
  const answered: AnswerTurnResult<Answered> = {
    evaluation,
    nextTurn: {
      id: nextTurn.id,
      order: nextTurn.order,
      question: nextTurn.question,
    },
    status: "answered",
  };
  return answered;
});
