// A graded Attempt: the grade, the answer key and, for a wrong answer, "Explain my answer".
// Ported from Grifando src/components/exercises/ExerciseResult.tsx (74dbb9f).
import type { GradedAttempt } from "@fluenshift/contract";
import { diffWords, findClosestAnswer } from "@fluenshift/core/answer-diff";
import { Button } from "@fluenshift/ui/components/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@fluenshift/ui/components/card";
import { useRouteContext } from "@tanstack/react-router";
import { useState } from "react";

import { AcademyRequestError, isKeyRequired } from "./academy-client";
import { BusyStatus, ButtonSpinner, EXPLAIN_STEPS } from "./busy-status";
import { KeyRequiredNotice } from "./key-required-notice";

const correctAnswerText = (exercise: GradedAttempt["exercise"]): string =>
  exercise.type === "MULTIPLE_CHOICE"
    ? (exercise.options[exercise.correctOptionIndex] ?? "")
    : (exercise.acceptableAnswers[0] ?? "");

// Free-text answers: compare against the acceptable answer closest to what the
// Learner wrote, word by word, instead of always showing the first one.
const AnswerDiff = ({
  acceptableAnswers,
  learnerAnswer,
}: {
  readonly acceptableAnswers: readonly string[];
  readonly learnerAnswer: string;
}) => {
  const expected = findClosestAnswer(learnerAnswer, [...acceptableAnswers]);
  if (expected === null) {
    return null;
  }

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground">
        Closest answer:{" "}
        <span className="prose-serif text-foreground text-lg">{expected}</span>
      </p>
      <p
        aria-label="Differences between your answer and the closest answer"
        className="prose-serif text-lg"
      >
        {diffWords(learnerAnswer, expected).map((segment, index) => (
          <span key={`${String(index)}:${segment.kind}`}>
            {index > 0 ? " " : null}
            {segment.kind === "removed" ? (
              <del className="text-destructive decoration-1">
                {segment.text}
              </del>
            ) : null}
            {segment.kind === "added" ? (
              <ins className="text-success no-underline">{segment.text}</ins>
            ) : null}
            {segment.kind === "same" ? segment.text : null}
          </span>
        ))}
      </p>
    </div>
  );
};

type ExplanationState =
  | { readonly kind: "idle" }
  | { readonly kind: "loading" }
  | { readonly kind: "done"; readonly text: string }
  | { readonly kind: "error"; readonly message: string }
  | { readonly kind: "keyRequired" };

const EXPLANATION_ERROR =
  "We couldn't explain this answer right now. Your grade is unaffected.";

// The explanation as the next view state; a missing key points to setup.
const explanationState = async (
  request: Promise<string>
): Promise<ExplanationState> => {
  try {
    return { kind: "done", text: await request };
  } catch (error) {
    if (isKeyRequired(error)) {
      return { kind: "keyRequired" };
    }
    // Grifando showed the route's own message when it wrote one.
    return {
      kind: "error",
      message:
        error instanceof AcademyRequestError
          ? (error.serverMessage ?? EXPLANATION_ERROR)
          : EXPLANATION_ERROR,
    };
  }
};

// "Explain my answer": an optional Trainer call on request; the grade above is
// already final and never changes.
const ExplainMyAnswer = ({
  attemptId,
  exerciseId,
}: {
  readonly attemptId: string;
  readonly exerciseId: string;
}) => {
  const { academyClient } = useRouteContext({ from: "__root__" });
  const [state, setState] = useState<ExplanationState>({ kind: "idle" });

  const handleExplain = async () => {
    setState({ kind: "loading" });
    setState(
      await explanationState(
        academyClient.explainAttempt(exerciseId, attemptId)
      )
    );
  };

  if (state.kind === "done") {
    return <p className="prose-serif text-iron text-lg">{state.text}</p>;
  }

  return (
    <div className="space-y-2">
      <Button
        disabled={state.kind === "loading"}
        onClick={() => {
          void handleExplain();
        }}
        size="sm"
        variant="outline"
      >
        {state.kind === "loading" ? (
          <>
            <ButtonSpinner /> Explaining…
          </>
        ) : (
          "Explain my answer"
        )}
      </Button>
      {state.kind === "loading" ? <BusyStatus steps={EXPLAIN_STEPS} /> : null}
      {state.kind === "error" ? (
        <p className="text-destructive text-sm">{state.message}</p>
      ) : null}
      {state.kind === "keyRequired" ? <KeyRequiredNotice /> : null}
    </div>
  );
};

export const ExerciseResult = ({
  exerciseId,
  hasNext,
  onNext,
  result,
  learnerAnswer,
}: {
  readonly exerciseId: string;
  readonly hasNext: boolean;
  readonly onNext: () => void;
  readonly result: GradedAttempt;
  readonly learnerAnswer: string;
}) => (
  <Card className="max-w-2xl">
    <CardHeader>
      <CardTitle
        className={result.isCorrect ? "text-success" : "text-destructive"}
      >
        {result.isCorrect ? "Correct" : "Not quite"}
      </CardTitle>
    </CardHeader>
    <CardContent className="space-y-4">
      {!result.isCorrect &&
      (result.exercise.type === "REWRITE" ||
        result.exercise.type === "TRANSLATION") ? (
        <AnswerDiff
          acceptableAnswers={result.exercise.acceptableAnswers}
          learnerAnswer={learnerAnswer}
        />
      ) : null}
      {!result.isCorrect &&
      (result.exercise.type === "MULTIPLE_CHOICE" ||
        result.exercise.type === "FILL_BLANK") ? (
        <p className="text-muted-foreground">
          Expected:{" "}
          <span className="prose-serif text-foreground text-lg">
            {correctAnswerText(result.exercise)}
          </span>
        </p>
      ) : null}
      <p className="text-iron">{result.explanation}</p>
      {result.isCorrect ? null : (
        <ExplainMyAnswer attemptId={result.attemptId} exerciseId={exerciseId} />
      )}
    </CardContent>
    <CardFooter>
      <Button onClick={onNext}>
        {hasNext ? "Next exercise" : "Done for now"}
      </Button>
    </CardFooter>
  </Card>
);
