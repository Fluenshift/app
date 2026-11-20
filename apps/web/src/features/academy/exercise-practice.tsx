// A practice set, one Exercise at a time. Ported from Grifando
// src/components/exercises/ExercisePractice.tsx (74dbb9f). The Academy client replaces Grifando's
// fetch and aiFetch; in the local profile no key travels from the browser, so a missing key is
// the server's AI_KEY_REQUIRED answer.
import type { GradedAttempt, PendingExercise } from "@fluenshift/contract";
import { Button } from "@fluenshift/ui/components/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@fluenshift/ui/components/card";
import { useRouteContext } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { AcademyRequestError, isKeyRequired } from "./academy-client";
import type { AcademyClient } from "./academy-client";
import { AttemptForm } from "./attempt-form";
import { BusyStatus, ButtonSpinner, EXERCISE_STEPS } from "./busy-status";
import { ExerciseResult } from "./exercise-result";
import { KeyRequiredNotice } from "./key-required-notice";

type State =
  | { readonly kind: "loading" }
  | { readonly kind: "empty" }
  | { readonly kind: "generating" }
  | { readonly kind: "practicing"; readonly queue: readonly PendingExercise[] }
  | {
      readonly exerciseId: string;
      readonly kind: "result";
      readonly queue: readonly PendingExercise[];
      readonly result: GradedAttempt;
    }
  | {
      readonly keyRequired?: boolean;
      readonly kind: "error";
      readonly message: string;
    };

const GENERIC_ERROR = "Something went wrong. Please try again.";

// A practice set becomes the next view state; a failure shows the message its route wrote.
const toQueueState = async (
  request: Promise<readonly PendingExercise[]>
): Promise<State> => {
  try {
    const queue = await request;
    return queue.length > 0 ? { kind: "practicing", queue } : { kind: "empty" };
  } catch (error) {
    return {
      keyRequired: isKeyRequired(error),
      kind: "error",
      message:
        error instanceof AcademyRequestError
          ? (error.serverMessage ?? GENERIC_ERROR)
          : GENERIC_ERROR,
    };
  }
};

// One graded Attempt as the next view state, or the generic failure.
const toResultState = async (
  request: Promise<GradedAttempt>,
  exerciseId: string,
  queue: readonly PendingExercise[]
): Promise<State> => {
  try {
    return { exerciseId, kind: "result", queue, result: await request };
  } catch {
    return { kind: "error", message: GENERIC_ERROR };
  }
};

const generate = (client: AcademyClient, afterEvaluationId?: string) =>
  toQueueState(
    client.generateExercises(
      afterEvaluationId === undefined ? {} : { afterEvaluationId }
    )
  );

// afterEvaluationId: the daily session's review step. Generates a fresh set that mixes that
// Evaluation's mistakes with due patterns, instead of resuming pending exercises.
export const ExercisePractice = ({
  afterEvaluationId,
}: {
  readonly afterEvaluationId?: string;
}) => {
  const { academyClient } = useRouteContext({ from: "__root__" });
  const [state, setState] = useState<State>({
    kind: afterEvaluationId === undefined ? "loading" : "generating",
  });
  const [answer, setAnswer] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const next = await (afterEvaluationId === undefined
        ? toQueueState(academyClient.listPendingExercises())
        : generate(academyClient, afterEvaluationId));
      if (!cancelled) {
        setState(next);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [academyClient, afterEvaluationId]);

  const loadExercises = async () => {
    setState({ kind: "loading" });
    setState(await toQueueState(academyClient.listPendingExercises()));
  };

  const handleGenerate = async () => {
    setState({ kind: "generating" });
    setState(await generate(academyClient, afterEvaluationId));
  };

  const handleSubmit = async () => {
    if (state.kind !== "practicing" || answer.trim().length === 0) {
      return;
    }
    const [current, ...rest] = state.queue;
    if (current === undefined) {
      return;
    }
    setState(
      await toResultState(
        academyClient.submitAttempt(current.id, answer),
        current.id,
        rest
      )
    );
  };

  const handleNext = () => {
    if (state.kind !== "result") {
      return;
    }
    setAnswer("");
    setState(
      state.queue.length > 0
        ? { kind: "practicing", queue: state.queue }
        : { kind: "empty" }
    );
  };

  if (state.kind === "loading") {
    return (
      <p aria-live="polite" className="text-muted-foreground">
        Loading exercises...
      </p>
    );
  }

  if (state.kind === "error") {
    return (
      <Card className="max-w-2xl">
        <CardContent className="space-y-4">
          {state.keyRequired === true ? (
            <KeyRequiredNotice />
          ) : (
            <p className="text-destructive" role="alert">
              {state.message}
            </p>
          )}
          <Button
            onClick={() => {
              void loadExercises();
            }}
            variant="outline"
          >
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (state.kind === "result") {
    return (
      <ExerciseResult
        exerciseId={state.exerciseId}
        hasNext={state.queue.length > 0}
        onNext={handleNext}
        result={state.result}
        learnerAnswer={answer}
      />
    );
  }

  if (state.kind === "empty" || state.kind === "generating") {
    const isGenerating = state.kind === "generating";
    return (
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>No exercises to practice right now</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="prose-serif text-iron text-lg">
            Exercises are generated from mistakes found in your writing. Write
            something first, or generate a practice set from what you already
            have.
          </p>
        </CardContent>
        <CardFooter>
          <Button
            disabled={isGenerating}
            onClick={() => {
              void handleGenerate();
            }}
          >
            {isGenerating ? (
              <>
                <ButtonSpinner /> Generating…
              </>
            ) : (
              "Generate practice set"
            )}
          </Button>
          {isGenerating ? (
            <BusyStatus className="ml-4" steps={EXERCISE_STEPS} />
          ) : null}
        </CardFooter>
      </Card>
    );
  }

  const [current] = state.queue;

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <p className="label-mono text-muted-foreground">
          {state.queue.length} left in this set
        </p>
      </CardHeader>
      <CardContent>
        {current === undefined ? null : (
          <AttemptForm
            answer={answer}
            exercise={current.prompt}
            onAnswerChange={setAnswer}
          />
        )}
      </CardContent>
      <CardFooter>
        <Button
          disabled={answer.trim().length === 0}
          onClick={() => {
            void handleSubmit();
          }}
        >
          Check answer
        </Button>
      </CardFooter>
    </Card>
  );
};
