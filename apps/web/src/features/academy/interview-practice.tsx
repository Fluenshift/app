// A text-based mock interview. Ported from Grifando
// src/components/interview/InterviewPractice.tsx (74dbb9f): each answer is a practice Writing
// Sample, its Evaluation is the turn's feedback (docs/adr/0010), and a failed Enrichment keeps the
// answer for the Learner to post again, since no failed session is retried (docs/adr/0024).
import type {
  InterviewAnswerResult,
  InterviewTurnRef,
  SampleLimits,
  StartedInterview,
} from "@grifando/contract";
import { Button } from "@grifando/ui/components/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@grifando/ui/components/card";
import { useRouteContext } from "@tanstack/react-router";
import { useState } from "react";

import { failureNotice } from "./academy-client";
import { BusyStatus, ButtonSpinner, INTERVIEW_STEPS } from "./busy-status";
import { KeyRequiredNotice } from "./key-required-notice";
import { TurnFeedback } from "./turn-feedback";
import type { CompletedTurn } from "./turn-feedback";
import { WritingSheet } from "./writing-sheet";

const GENERIC_ERROR = "Something went wrong. Please try again.";

interface Interviewing {
  readonly currentTurn: InterviewTurnRef;
  readonly history: readonly CompletedTurn[];
  readonly sessionId: string;
}

type State =
  | {
      readonly errorMessage?: string;
      readonly keyRequired?: boolean;
      readonly kind: "idle";
    }
  | { readonly kind: "starting" }
  | (Interviewing & {
      readonly errorMessage?: string;
      readonly keyRequired?: boolean;
      readonly kind: "active";
    })
  | (Interviewing & { readonly kind: "submitting" })
  | { readonly history: readonly CompletedTurn[]; readonly kind: "ended" };

// The new interview as the next view state.
const startState = async (
  request: Promise<StartedInterview>
): Promise<State> => {
  try {
    const { sessionId, turn } = await request;
    return { currentTurn: turn, history: [], kind: "active", sessionId };
  } catch (error) {
    return { ...failureNotice(error, GENERIC_ERROR), kind: "idle" };
  }
};

// One answer's result as the next view state; `answered` is true when the sheet empties.
const answerState = async (
  request: Promise<InterviewAnswerResult>,
  interviewing: Interviewing,
  answer: string
): Promise<{ readonly answered: boolean; readonly state: State }> => {
  try {
    const result = await request;
    if (result.status === "failed") {
      return {
        answered: false,
        state: {
          ...interviewing,
          errorMessage: result.message,
          kind: "active",
        },
      };
    }
    const history = [
      ...interviewing.history,
      {
        answer,
        evaluation: result.evaluation,
        naturalVersion: result.naturalVersion,
        question: interviewing.currentTurn.question,
      },
    ];
    return {
      answered: true,
      state:
        result.status === "ended"
          ? { history, kind: "ended" }
          : {
              currentTurn: result.nextTurn,
              history,
              kind: "active",
              sessionId: interviewing.sessionId,
            },
    };
  } catch (error) {
    return {
      answered: false,
      state: {
        ...interviewing,
        ...failureNotice(error, GENERIC_ERROR),
        kind: "active",
      },
    };
  }
};

// Ending is best-effort: the wrap-up shows regardless.
const endQuietly = async (request: Promise<void>) => {
  try {
    await request;
  } catch {
    // Grifando showed the wrap-up whatever the route answered.
  }
};

export const InterviewPractice = ({
  sampleLimits,
}: {
  // The Deploy Profile's caps, which size the answer sheet (docs/adr/0006).
  readonly sampleLimits: SampleLimits;
}) => {
  const { academyClient } = useRouteContext({ from: "__root__" });
  const [state, setState] = useState<State>({ kind: "idle" });
  const [answer, setAnswer] = useState("");

  const handleStart = async () => {
    setState({ kind: "starting" });
    setState(await startState(academyClient.startInterview()));
  };

  const handleSubmit = async () => {
    if (state.kind !== "active") {
      return;
    }
    const interviewing: Interviewing = {
      currentTurn: state.currentTurn,
      history: state.history,
      sessionId: state.sessionId,
    };
    setState({ ...interviewing, kind: "submitting" });
    const next = await answerState(
      academyClient.answerInterviewTurn(
        state.sessionId,
        state.currentTurn.id,
        answer
      ),
      interviewing,
      answer
    );
    if (next.answered) {
      setAnswer("");
    }
    setState(next.state);
  };

  const handleEnd = async () => {
    if (state.kind !== "active") {
      return;
    }
    const { history } = state;
    await endQuietly(academyClient.endInterview(state.sessionId));
    setState({ history, kind: "ended" });
  };

  const handleRestart = () => {
    setAnswer("");
    setState({ kind: "idle" });
  };

  if (state.kind === "idle" || state.kind === "starting") {
    return (
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Ready when you are</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="prose-serif text-iron text-lg">
            A text-based software engineering interview. The interviewer asks a
            question, you answer in English, and each answer is evaluated like
            any other writing.
          </p>
          {state.kind === "idle" && state.keyRequired === true ? (
            <KeyRequiredNotice />
          ) : null}
          {state.kind === "idle" && state.errorMessage !== undefined ? (
            <p className="text-destructive text-sm" role="alert">
              {state.errorMessage}
            </p>
          ) : null}
        </CardContent>
        <CardFooter>
          <Button
            disabled={state.kind === "starting"}
            onClick={() => {
              void handleStart();
            }}
          >
            {state.kind === "starting" ? "Starting..." : "Start interview"}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (state.kind === "ended") {
    return (
      <div className="space-y-16">
        {state.history.map((turn, index) => (
          <TurnFeedback
            index={index}
            key={`${String(index)}:${turn.question}`}
            turn={turn}
          />
        ))}
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-heading-sm">Interview complete.</p>
            <Button onClick={handleRestart} variant="outline">
              Start a new interview
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isSubmitting = state.kind === "submitting";

  return (
    <div className="space-y-16">
      {state.history.map((turn, index) => (
        <TurnFeedback
          index={index}
          key={`${String(index)}:${turn.question}`}
          turn={turn}
        />
      ))}

      <section className="grid gap-x-16 gap-y-8 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-3">
          <p className="label-mono text-muted-foreground">
            Question {state.history.length + 1}
          </p>
          <h2 className="text-heading-sm">{state.currentTurn.question}</h2>
        </div>
        <div className="space-y-6">
          <WritingSheet
            disabled={isSubmitting}
            label="Your answer"
            maxLength={sampleLimits.sampleMaxCharacters}
            minHeight="min-h-[240px]"
            onChange={setAnswer}
            placeholder="Answer in English..."
            value={answer}
          />
          {state.kind === "active" && state.keyRequired === true ? (
            <KeyRequiredNotice />
          ) : null}
          {state.kind === "active" && state.errorMessage !== undefined ? (
            <p className="text-destructive text-sm" role="alert">
              {state.errorMessage}
            </p>
          ) : null}
          <div
            className="flex flex-wrap items-center justify-between gap-3"
            data-slot="actions"
          >
            <Button
              disabled={isSubmitting || answer.trim().length === 0}
              onClick={() => {
                void handleSubmit();
              }}
            >
              {isSubmitting ? (
                <>
                  <ButtonSpinner /> Analyzing…
                </>
              ) : (
                "Submit answer"
              )}
            </Button>
            <Button
              disabled={isSubmitting}
              onClick={() => {
                void handleEnd();
              }}
              variant="ghost"
            >
              End interview
            </Button>
          </div>
          {isSubmitting ? <BusyStatus steps={INTERVIEW_STEPS} /> : null}
        </div>
      </section>
    </div>
  );
};
