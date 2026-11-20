// The Academy's writing screen: the sheet and, beside it, the Practice Prompt or what feedback
// brings. Ported from Grifando src/components/writing/WritingCoach.tsx (74dbb9f), in its editing
// view; the submit and the results arrive with practice writing (#160).
import { useState } from "react";

import { WritingSheet } from "./writing-sheet";

const MAX_LENGTH = 5000;

export type InitialChallenge =
  | { readonly promptText: string; readonly promptType: "DAILY_CHALLENGE" }
  | {
      readonly promptText: string;
      readonly promptType: "TECHNICAL";
      readonly technicalCategory: string;
    };

export const WritingCoach = ({
  initialChallenge,
}: {
  readonly initialChallenge?: InitialChallenge;
}) => {
  const [text, setText] = useState("");

  return (
    <div className="grid gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        <WritingSheet
          label={initialChallenge === undefined ? "Your text" : "Your answer"}
          maxLength={MAX_LENGTH}
          onChange={setText}
          placeholder={
            initialChallenge === undefined
              ? "Free writing, a GitHub issue, a PR description, an explanation of something you built today..."
              : "Write your answer here..."
          }
          value={text}
        />
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
