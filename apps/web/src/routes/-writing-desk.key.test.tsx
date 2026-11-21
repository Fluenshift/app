// The Writing Desk in the hosted profile, whose Judge runs on the visitor's OpenRouter key
// (docs/adr/0035): a missing key keeps the draft and points to the key page.
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { EvaluationRequestError } from "../features/evaluations/evaluation-client";
import { createInMemoryEvaluationClient } from "../features/evaluations/in-memory-evaluation-client";
import { MissingAIKeyError } from "../features/settings/ai-key-store";
import { createAppRouter } from "../router";

// The Writing Desk's alert after an Evaluation that failed with `error`.
const evaluateFailing = async (error: Error) => {
  const user = userEvent.setup();
  render(
    <RouterProvider
      router={createAppRouter({
        deployProfile: "hosted",
        evaluationClient: createInMemoryEvaluationClient({
          attempts: [{ error, kind: "failure" }],
        }),
        history: createMemoryHistory({ initialEntries: ["/"] }),
      })}
    />
  );
  const input = await screen.findByLabelText("Writing Sample");
  await user.type(input, "I depend of this library.");
  await user.click(screen.getByRole("button", { name: "Evaluate writing" }));
  return { alert: await screen.findByRole("alert"), input };
};

describe("Writing Desk key", () => {
  test("points to the key page when the browser holds no key", async () => {
    const { alert, input } = await evaluateFailing(new MissingAIKeyError());

    expect(alert).toHaveTextContent(
      "Feedback on your writing needs an OpenRouter key."
    );
    expect(
      within(alert).getByRole("link", { name: "Set up a key" })
    ).toHaveAttribute("href", "/settings");
    expect(input).toHaveValue("I depend of this library.");
  });

  test("points to the key page when the server finds no OpenRouter key", async () => {
    const { alert } = await evaluateFailing(
      new EvaluationRequestError(
        { status: 401 },
        { code: "AI_JUDGE_KEY_REQUIRED" }
      )
    );

    expect(alert).toHaveTextContent(
      "Feedback on your writing needs an OpenRouter key."
    );
    expect(
      within(alert).getByRole("link", { name: "Set up a key" })
    ).toHaveAttribute("href", "/settings");
  });

  test("keeps the key page out of any other failure", async () => {
    const { alert } = await evaluateFailing(
      new EvaluationRequestError(
        { status: 504 },
        { code: "provider-timeout", retryable: true }
      )
    );

    expect(alert).toHaveTextContent(
      "The provider took too long. Wait a moment, then retry."
    );
    expect(within(alert).queryByRole("link")).not.toBeInTheDocument();
  });
});
