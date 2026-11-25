// Grifando's Explain code page, src/app/explain-code/page.tsx and
// src/components/writing/ExplainCodeCoach.tsx (74dbb9f), ported from source under docs/adr/0025,
// decision 5: no baseline test renders them, so these assert Grifando's copy, roles and calls.
// The explanation goes to practice writing with its snippet, which only the Trainer receives
// (docs/adr/0038), and the Deploy Profile's caps size both sheets (docs/adr/0006).
import type {
  Evaluation,
  PracticeWritingResult,
  SampleLimits,
} from "@grifando/contract";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AcademyRequestError } from "../features/academy/academy-client";
import { createInMemoryAcademyClient } from "../features/academy/in-memory-academy-client";
import { createInMemoryEvaluationClient } from "../features/evaluations/in-memory-evaluation-client";
import { createAppRouter } from "../router";

const EXPLANATION = "This function goed through every user.";
const SNIPPET = "export const users = load();";

const HOSTED_LIMITS: SampleLimits = {
  codeMaxCharacters: 2000,
  sampleMaxBytes: 32_768,
  sampleMaxCharacters: 5000,
};

const evaluation: Evaluation = {
  band: "Clear",
  correctedText: "This function went through every user.",
  evaluatedAt: "2026-03-05T12:00:00.000Z",
  evaluatedEnglishWordCount: 6,
  findings: [
    {
      byteEnd: 18,
      byteStart: 14,
      category: "Verb form/tense",
      correction: "went",
      explanation: "'Go' has an irregular past: 'went'.",
      originalText: "goed",
      severity: "Moderate",
    },
  ],
  id: "practice-1",
  model: "judge-model",
  originalText: EXPLANATION,
  provider: "test",
  rubricVersion: "1",
  score: 76,
  suggestions: [],
  summary: "One verb form mistake.",
};

const evaluated: PracticeWritingResult = {
  evaluation,
  naturalVersion: null,
  occurrences: [],
  status: "evaluated",
};

const renderExplainCode = async (
  practiceWriting: PracticeWritingResult | AcademyRequestError = evaluated,
  sampleLimits: SampleLimits = HOSTED_LIMITS
) => {
  const client = createInMemoryAcademyClient({
    practiceWriting,
    sampleLimits,
    vocabulary: [],
  });
  render(
    <RouterProvider
      router={createAppRouter({
        academyClient: client,
        evaluationClient: createInMemoryEvaluationClient(),
        history: createMemoryHistory({ initialEntries: ["/explain-code"] }),
      })}
    />
  );
  const page = await screen.findByRole("main");
  return {
    client,
    code: within(page).getByRole("textbox", { name: "Code snippet" }),
    explanation: within(page).getByRole("textbox", {
      name: "Your explanation, in English",
    }),
    page,
  };
};

const fillBoth = async (
  code: HTMLElement,
  explanation: HTMLElement
): Promise<void> => {
  await userEvent.type(code, SNIPPET);
  await userEvent.type(explanation, EXPLANATION);
};

describe("/explain-code", () => {
  it("offers a code sheet and an explanation sheet under Grifando's heading, capped by the Deploy Profile", async () => {
    const { code, explanation, page } = await renderExplainCode();

    expect(
      within(page).getByRole("heading", { level: 1, name: "Explain code" })
    ).toBeVisible();
    expect(
      within(page).getByText(
        "Paste a small snippet and explain what it does in English — the way you would in a code review."
      )
    ).toBeVisible();
    expect(code).toHaveAttribute(
      "placeholder",
      "export async function registerUser(...) { ... }"
    );
    expect(code).toHaveAttribute("maxlength", "2000");
    expect(within(page).getByText("0 / 2000")).toBeVisible();
    expect(explanation).toHaveAttribute(
      "placeholder",
      "This function checks whether..."
    );
    expect(explanation).toHaveAttribute("maxlength", "5000");
    expect(within(page).getByText("0 / 5000")).toBeVisible();
  });

  it("waits for both a snippet and an explanation before it asks for feedback", async () => {
    const { code, explanation, page } = await renderExplainCode();
    const submit = within(page).getByRole("button", { name: "Get feedback" });

    expect(submit).toBeDisabled();
    await userEvent.type(explanation, EXPLANATION);
    expect(submit).toBeDisabled();
    await userEvent.type(code, "   ");
    expect(submit).toBeDisabled();
    await userEvent.clear(explanation);
    await userEvent.type(code, SNIPPET);
    expect(submit).toBeDisabled();
    await userEvent.type(explanation, EXPLANATION);
    expect(submit).toBeEnabled();
  });

  it("sends the explanation with its snippet, and shows the results on the Evaluation", async () => {
    const { client, code, explanation, page } = await renderExplainCode();
    await fillBoth(code, explanation);
    await userEvent.click(
      within(page).getByRole("button", { name: "Get feedback" })
    );

    const results = await within(page).findByRole("region", {
      name: "Your writing",
    });
    expect(client.writeRequests).toStrictEqual([EXPLANATION]);
    expect(client.codeSnippets).toStrictEqual([SNIPPET]);
    expect(results).toHaveTextContent(EXPLANATION);
    expect(
      within(page).getByRole("region", { name: "Corrected version" })
    ).toHaveTextContent("This function went through every user.");
  });

  it("clears both sheets to explain another snippet", async () => {
    const { code, explanation, page } = await renderExplainCode();
    await fillBoth(code, explanation);
    await userEvent.click(
      within(page).getByRole("button", { name: "Get feedback" })
    );
    await userEvent.click(
      await within(page).findByRole("button", {
        name: "Write something else",
      })
    );

    expect(
      within(page).getByRole("textbox", { name: "Code snippet" })
    ).toHaveValue("");
    expect(
      within(page).getByRole("textbox", {
        name: "Your explanation, in English",
      })
    ).toHaveValue("");
  });

  it("keeps both sheets and shows Grifando's message when practice writing fails", async () => {
    const { code, explanation, page } = await renderExplainCode(
      new AcademyRequestError(500, { code: "INTERNAL_ERROR" })
    );
    await fillBoth(code, explanation);
    await userEvent.click(
      within(page).getByRole("button", { name: "Get feedback" })
    );

    expect(await within(page).findByRole("alert")).toHaveTextContent(
      "We couldn't analyze this writing right now. Your text has not been lost."
    );
    expect(code).toHaveValue(SNIPPET);
    expect(explanation).toHaveValue(EXPLANATION);
  });

  it("asks for a key when the Trainer has none", async () => {
    const { code, explanation, page } = await renderExplainCode(
      new AcademyRequestError(401, {
        code: "AI_KEY_REQUIRED",
        error: "Set up your AI key to get feedback.",
      })
    );
    await fillBoth(code, explanation);
    await userEvent.click(
      within(page).getByRole("button", { name: "Get feedback" })
    );

    expect(await within(page).findByRole("alert")).toHaveTextContent(
      "Set up your AI key to get feedback."
    );
    expect(
      within(page).getByRole("link", { name: "Set up a key" })
    ).toHaveAttribute("href", "/setup");
  });

  it("leaves the code sheet uncapped when the Deploy Profile caps no code", async () => {
    const { code, page } = await renderExplainCode(evaluated, {
      codeMaxCharacters: null,
      sampleMaxBytes: 32_768,
      sampleMaxCharacters: null,
    });

    expect(code).not.toHaveAttribute("maxlength");
    expect(within(page).getAllByText("0 characters")).toHaveLength(2);
  });
});
