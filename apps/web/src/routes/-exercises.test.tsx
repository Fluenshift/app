// Grifando's /exercises page (74dbb9f): ExercisePractice, ExerciseQuestion and ExerciseResult,
// ported from their source under docs/adr/0025, decision 5, since no Grifando test renders them.
// These screen tests assert Grifando's copy, roles and calls on the in-memory Academy client.
import type { GradedAttempt, PendingExercise } from "@fluenshift/contract";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AcademyRequestError } from "../features/academy/academy-client";
import { createInMemoryAcademyClient } from "../features/academy/in-memory-academy-client";
import { createInMemoryEvaluationClient } from "../features/evaluations/in-memory-evaluation-client";
import { createAppRouter } from "../router";

const multipleChoice: PendingExercise = {
  id: "choice",
  prompt: {
    instruction: "Choose the correct sentence.",
    options: ["I depend of this library.", "I depend on this library."],
    type: "MULTIPLE_CHOICE",
  },
  type: "MULTIPLE_CHOICE",
};

const rewrite: PendingExercise = {
  id: "rewrite",
  prompt: {
    instruction: "Rewrite the sentence correctly.",
    original: "I depend of this library.",
    type: "REWRITE",
  },
  type: "REWRITE",
};

const gradedChoice: GradedAttempt = {
  attemptId: "attempt-choice",
  exercise: {
    correctOptionIndex: 1,
    explanation: "Use 'depend on', not 'depend of'.",
    instruction: "Choose the correct sentence.",
    options: ["I depend of this library.", "I depend on this library."],
    type: "MULTIPLE_CHOICE",
  },
  explanation: "Use 'depend on', not 'depend of'.",
  isCorrect: false,
};

const gradedRewrite: GradedAttempt = {
  attemptId: "attempt-rewrite",
  exercise: {
    acceptableAnswers: ["I depend on this library."],
    explanation: "'Depend' takes 'on'.",
    instruction: "Rewrite the sentence correctly.",
    original: "I depend of this library.",
    type: "REWRITE",
  },
  explanation: "'Depend' takes 'on'.",
  isCorrect: false,
};

const renderExercises = async (
  exercises: NonNullable<
    Parameters<typeof createInMemoryAcademyClient>[0]
  >["exercises"]
) => {
  const client = createInMemoryAcademyClient({ exercises });
  render(
    <RouterProvider
      router={createAppRouter({
        academyClient: client,
        evaluationClient: createInMemoryEvaluationClient(),
        history: createMemoryHistory({ initialEntries: ["/exercises"] }),
      })}
    />
  );
  const page = await screen.findByRole("main");
  return { client, page };
};

describe("/exercises", () => {
  it("asks the pending set one question at a time and grades each answer", async () => {
    const { client, page } = await renderExercises({
      graded: { choice: gradedChoice, rewrite: gradedRewrite },
      pending: [multipleChoice, rewrite],
    });
    expect(page).toHaveTextContent(
      "Built from your own mistakes. Answer before you see the solution — recall is what makes it stick."
    );
    expect(await within(page).findByText("2 left in this set")).toBeVisible();
    expect(page).toHaveTextContent("Choose the correct sentence.");
    const check = within(page).getByRole("button", { name: "Check answer" });
    expect(check).toBeDisabled();

    await userEvent.click(
      within(page).getByRole("radio", { name: "I depend of this library." })
    );
    await userEvent.click(check);
    expect(client.attemptRequests).toEqual([
      { answer: "0", exerciseId: "choice" },
    ]);
    expect(await within(page).findByText("Not quite")).toBeVisible();
    expect(page).toHaveTextContent("Expected: I depend on this library.");
    expect(page).toHaveTextContent("Use 'depend on', not 'depend of'.");

    await userEvent.click(
      within(page).getByRole("button", { name: "Next exercise" })
    );
    expect(await within(page).findByText("1 left in this set")).toBeVisible();
    await userEvent.type(
      within(page).getByRole("textbox", { name: "Your rewrite" }),
      "I rely on this library."
    );
    await userEvent.click(
      within(page).getByRole("button", { name: "Check answer" })
    );
    expect(await within(page).findByText("Not quite")).toBeVisible();
    expect(page).toHaveTextContent("Closest answer: I depend on this library.");
    const differences = within(page).getByLabelText(
      "Differences between your answer and the closest answer"
    );
    expect(
      [...differences.querySelectorAll("del")].map((part) => part.textContent)
    ).toEqual(["rely"]);
    expect(
      [...differences.querySelectorAll("ins")].map((part) => part.textContent)
    ).toEqual(["depend"]);
    expect(
      within(page).getByRole("button", { name: "Done for now" })
    ).toBeVisible();
  });

  it("generates a practice set when none is pending", async () => {
    const { client, page } = await renderExercises({
      generated: [multipleChoice],
      pending: [],
    });
    expect(
      await within(page).findByText("No exercises to practice right now")
    ).toBeVisible();
    await userEvent.click(
      within(page).getByRole("button", { name: "Generate practice set" })
    );

    expect(await within(page).findByText("1 left in this set")).toBeVisible();
    expect(client.generationRequests).toEqual([{}]);
  });

  it("shows the route's message when a set cannot be generated", async () => {
    const { page } = await renderExercises({
      generated: new AcademyRequestError(422, {
        error:
          "No mistake patterns yet — write something first to get personalized exercises.",
      }),
      pending: [],
    });
    await userEvent.click(
      await within(page).findByRole("button", { name: "Generate practice set" })
    );

    expect(await within(page).findByRole("alert")).toHaveTextContent(
      "No mistake patterns yet — write something first to get personalized exercises."
    );
    expect(
      within(page).getByRole("button", { name: "Try again" })
    ).toBeVisible();
  });

  it("points to setup when the Trainer has no key", async () => {
    const { page } = await renderExercises({
      generated: new AcademyRequestError(401, {
        code: "AI_KEY_REQUIRED",
        error: "Set up your AI key to get feedback.",
      }),
      pending: [],
    });
    await userEvent.click(
      await within(page).findByRole("button", { name: "Generate practice set" })
    );

    expect(await within(page).findByRole("alert")).toHaveTextContent(
      "Set up your AI key to get feedback."
    );
    expect(
      within(page).getByRole("link", { name: "Set up a key" })
    ).toHaveAttribute("href", "/setup");
  });

  it("explains a wrong answer on request and keeps the grade", async () => {
    const { page } = await renderExercises({
      explanation: "'Depend' always takes 'on' in English.",
      graded: { choice: gradedChoice },
      pending: [multipleChoice],
    });
    await userEvent.click(
      await within(page).findByRole("radio", {
        name: "I depend of this library.",
      })
    );
    await userEvent.click(
      within(page).getByRole("button", { name: "Check answer" })
    );
    await userEvent.click(
      await within(page).findByRole("button", { name: "Explain my answer" })
    );

    expect(
      await within(page).findByText("'Depend' always takes 'on' in English.")
    ).toBeVisible();
    expect(within(page).getByText("Not quite")).toBeVisible();
  });

  it("says the grade stands when the explanation fails", async () => {
    const { page } = await renderExercises({
      explanation: new AcademyRequestError(500),
      graded: { choice: gradedChoice },
      pending: [multipleChoice],
    });
    await userEvent.click(
      await within(page).findByRole("radio", {
        name: "I depend of this library.",
      })
    );
    await userEvent.click(
      within(page).getByRole("button", { name: "Check answer" })
    );
    await userEvent.click(
      await within(page).findByRole("button", { name: "Explain my answer" })
    );

    expect(
      await within(page).findByText(
        "We couldn't explain this answer right now. Your grade is unaffected."
      )
    ).toBeVisible();
  });
});
