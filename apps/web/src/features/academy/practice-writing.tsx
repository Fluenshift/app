// The Academy's writing screen: the sheet, the Practice Prompt or what feedback brings, and the
// results. Ported from Grifando src/components/writing/WritingCoach.tsx (74dbb9f): the text goes
// to practice writing (docs/adr/0026), and no failed session is retried, since an Evaluation
// cannot be evaluated again in place (docs/adr/0024); the Learner posts the text again.
import type {
  Evaluation,
  PracticeOccurrence,
  SampleLimits,
  TechnicalCategory,
} from "@fluenshift/contract";
import { Button } from "@fluenshift/ui/components/button";
import { useRouteContext } from "@tanstack/react-router";
import { useState } from "react";

import { failureNotice } from "./academy-client";
import { BusyStatus, ButtonSpinner, WRITING_STEPS } from "./busy-status";
import { KeyRequiredNotice } from "./key-required-notice";
import { PracticeEvaluation } from "./practice-evaluation";
import { WritingSheet } from "./writing-sheet";

const GENERIC_FAILURE_MESSAGE =
  "We couldn't analyze this writing right now. Your text has not been lost.";

export type InitialChallenge =
  | { readonly promptText: string; readonly promptType: "DAILY_CHALLENGE" }
  | {
      readonly promptText: string;
      readonly promptType: "TECHNICAL";
      readonly technicalCategory: TechnicalCategory;
    };

type ViewState =
  | {
      readonly errorMessage?: string;
      readonly keyRequired?: boolean;
      readonly kind: "editing";
    }
  | { readonly kind: "submitting" }
  | {
      readonly evaluation: Evaluation;
      readonly kind: "result";
      readonly naturalVersion: string | null;
      readonly occurrences: readonly PracticeOccurrence[];
    };

// Practice writing's answer as the next view state.
const submitState = async (
  request: Promise<
    | {
        readonly evaluation: Evaluation;
        readonly naturalVersion: string | null;
        readonly occurrences: readonly PracticeOccurrence[];
        readonly status: "evaluated";
      }
    | { readonly message: string; readonly status: "failed" }
  >
): Promise<ViewState> => {
  try {
    const result = await request;
    return result.status === "failed"
      ? { errorMessage: result.message, kind: "editing" }
      : {
          evaluation: result.evaluation,
          kind: "result",
          naturalVersion: result.naturalVersion,
          occurrences: result.occurrences,
        };
  } catch (error) {
    return {
      ...failureNotice(error, GENERIC_FAILURE_MESSAGE),
      kind: "editing",
    };
  }
};

export const PracticeWriting = ({
  initialChallenge,
  nextStep,
  sampleLimits,
}: {
  readonly initialChallenge?: InitialChallenge;
  // Shown after a successful Evaluation; receives the Evaluation's id.
  readonly nextStep?: {
    readonly label: string;
    readonly onClick: (evaluationId: string) => void;
  };
  // The Deploy Profile's caps, which size the sheet (docs/adr/0006).
  readonly sampleLimits: SampleLimits;
}) => {
  const { academyClient } = useRouteContext({ from: "__root__" });
  const [text, setText] = useState("");
  const [view, setView] = useState<ViewState>({ kind: "editing" });

  const handleSubmit = async () => {
    setView({ kind: "submitting" });
    setView(await submitState(academyClient.writePractice(text)));
  };

  const handleWriteAnother = () => {
    setText("");
    setView({ kind: "editing" });
  };

  if (view.kind === "result") {
    const { evaluation } = view;
    return (
      <PracticeEvaluation
        evaluation={evaluation}
        naturalVersion={view.naturalVersion}
        occurrences={view.occurrences}
        onWriteAnother={handleWriteAnother}
        {...(nextStep === undefined
          ? {}
          : {
              nextStep: {
                label: nextStep.label,
                onClick: () => {
                  nextStep.onClick(evaluation.id);
                },
              },
            })}
      />
    );
  }

  const isSubmitting = view.kind === "submitting";

  return (
    <div className="grid gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <WritingSheet
          disabled={isSubmitting}
          label={initialChallenge === undefined ? "Your text" : "Your answer"}
          maxLength={sampleLimits.sampleMaxCharacters}
          onChange={setText}
          placeholder={
            initialChallenge === undefined
              ? "Free writing, a GitHub issue, a PR description, an explanation of something you built today..."
              : "Write your answer here..."
          }
          value={text}
        />
        {view.kind === "editing" && view.keyRequired === true ? (
          <KeyRequiredNotice />
        ) : null}
        {view.kind === "editing" && view.errorMessage !== undefined ? (
          <p className="text-destructive text-sm" role="alert">
            {view.errorMessage}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3" data-slot="actions">
          <Button
            disabled={isSubmitting || text.trim().length === 0}
            onClick={() => {
              void handleSubmit();
            }}
          >
            {isSubmitting ? (
              <>
                <ButtonSpinner /> Analyzing…
              </>
            ) : (
              "Get feedback"
            )}
          </Button>
          {isSubmitting ? <BusyStatus steps={WRITING_STEPS} /> : null}
        </div>
      </div>

      <aside className="order-first space-y-4 lg:order-none lg:pt-6">
        {initialChallenge === undefined ? (
          <>
            <h2 className="label-mono text-muted-foreground">
              What you get back
            </h2>
            <p className="prose-serif text-iron text-lg">
              Your text with each mistake marked, a corrected version that keeps
              what you meant, and a natural version — one way a fluent speaker
              might say it.
            </p>
          </>
        ) : (
          <>
            <h2 className="label-mono text-muted-foreground">Prompt</h2>
            <p className="text-heading-sm">{initialChallenge.promptText}</p>
          </>
        )}
      </aside>
    </div>
  );
};
