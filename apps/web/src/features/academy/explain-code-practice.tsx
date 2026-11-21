// Explain code: a snippet and the Learner's explanation of it, in English. Ported from Grifando
// src/components/writing/ExplainCodeCoach.tsx (74dbb9f): the explanation goes to practice writing
// with the snippet, which only the Trainer receives (docs/adr/0038), and no failed session is
// retried, as on /write (docs/adr/0024). The Deploy Profile's caps size both sheets
// (docs/adr/0006).
import type { SampleLimits } from "@fluenshift/contract";
import { Button } from "@fluenshift/ui/components/button";
import { useRouteContext } from "@tanstack/react-router";
import { useState } from "react";

import { BusyStatus, ButtonSpinner, WRITING_STEPS } from "./busy-status";
import { KeyRequiredNotice } from "./key-required-notice";
import { PracticeEvaluation } from "./practice-evaluation";
import { submitState } from "./practice-writing";
import type { ViewState } from "./practice-writing";
import { WritingSheet } from "./writing-sheet";

export const ExplainCodePractice = ({
  sampleLimits,
}: {
  readonly sampleLimits: SampleLimits;
}) => {
  const { academyClient } = useRouteContext({ from: "__root__" });
  const [code, setCode] = useState("");
  const [text, setText] = useState("");
  const [view, setView] = useState<ViewState>({ kind: "editing" });

  const handleSubmit = async () => {
    setView({ kind: "submitting" });
    setView(await submitState(academyClient.writePractice(text, code)));
  };

  const handleWriteAnother = () => {
    setCode("");
    setText("");
    setView({ kind: "editing" });
  };

  if (view.kind === "result") {
    return (
      <PracticeEvaluation
        evaluation={view.evaluation}
        naturalVersion={view.naturalVersion}
        occurrences={view.occurrences}
        onWriteAnother={handleWriteAnother}
      />
    );
  }

  const isSubmitting = view.kind === "submitting";
  const canSubmit = code.trim().length > 0 && text.trim().length > 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <WritingSheet
          disabled={isSubmitting}
          label="Code snippet"
          maxLength={sampleLimits.codeMaxCharacters}
          onChange={setCode}
          placeholder="export async function registerUser(...) { ... }"
          value={code}
          variant="code"
        />
        <WritingSheet
          disabled={isSubmitting}
          label="Your explanation, in English"
          maxLength={sampleLimits.sampleMaxCharacters}
          onChange={setText}
          placeholder="This function checks whether..."
          value={text}
        />
      </div>
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
          disabled={isSubmitting || !canSubmit}
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
  );
};
