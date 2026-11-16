// The interview: the Trainer asks questions and follow-ups, and the Judge evaluates each answer
// as a practice Writing Sample (docs/adr/0010). Ported from Grifando
// src/server/domain/interview/interviewService.ts (74dbb9f).
import type { InterviewStatus } from "@fluenshift/contract";
import { Effect } from "effect";

import type { NotFoundError } from "./errors";
import type { TrainerMethods } from "./trainer/trainer-model";

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

const PLACEHOLDER_TURN: InterviewTurn = {
  answer: null,
  answeredAt: null,
  evaluationId: null,
  id: "",
  model: "",
  order: -1,
  question: "",
};

export const startInterview = (
  _trainer: TrainerMethods
): Effect.Effect<{
  readonly sessionId: string;
  readonly turn: InterviewTurn;
}> => Effect.succeed({ sessionId: "", turn: PLACEHOLDER_TURN });

export const getSession = (
  _sessionId: string
): Effect.Effect<InterviewSession | null> => Effect.succeed(null);

export const answerTurn = <Answered extends { readonly id: string }, E, R>(
  evaluate: (answer: string) => Effect.Effect<Answered, E, R>,
  _trainer: TrainerMethods,
  input: AnswerTurnInput
): Effect.Effect<AnswerTurnResult<Answered>, E | NotFoundError, R> =>
  evaluate(input.answer).pipe(
    Effect.map((evaluation) => ({ evaluation, status: "ended" as const }))
  );

export const endInterview = (_sessionId: string): Effect.Effect<boolean> =>
  Effect.succeed(false);
