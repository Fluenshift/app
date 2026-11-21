// Grifando's /interview page (74dbb9f): InterviewPractice and TurnFeedback, ported from their
// source under docs/adr/0025, decision 5. Each answer is a practice Writing Sample whose
// Evaluation is its feedback, with no separate interview score (docs/adr/0010), and a failed
// Enrichment keeps the answer and shows the route's message (docs/adr/0024).
import type {
  Evaluation,
  InterviewAnswerResult,
  SampleLimits,
} from "@fluenshift/contract";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AcademyRequestError } from "../features/academy/academy-client";
import { createInMemoryAcademyClient } from "../features/academy/in-memory-academy-client";
import { createInMemoryEvaluationClient } from "../features/evaluations/in-memory-evaluation-client";
import { createAppRouter } from "../router";

const evaluationOf = (answer: string, correctedText: string): Evaluation => ({
  band: "Clear",
  correctedText,
  evaluatedAt: "2026-03-05T12:00:00.000Z",
  evaluatedEnglishWordCount: 6,
  findings: [],
  id: `evaluation-of-${answer.length.toString()}`,
  model: "judge-model",
  originalText: answer,
  provider: "test",
  rubricVersion: "1",
  score: 82,
  suggestions: [],
  summary: "One tense mistake.",
});

const firstTurn = {
  id: "turn-1",
  order: 1,
  question: "Tell me about a project you worked on recently.",
};

const renderInterview = async (
  interview: NonNullable<
    Parameters<typeof createInMemoryAcademyClient>[0]
  >["interview"]
) => {
  const client = createInMemoryAcademyClient({ interview });
  render(
    <RouterProvider
      router={createAppRouter({
        academyClient: client,
        evaluationClient: createInMemoryEvaluationClient(),
        history: createMemoryHistory({ initialEntries: ["/interview"] }),
      })}
    />
  );
  const page = await screen.findByRole("main");
  return { client, page };
};

const answered = (
  answer: string,
  next: { readonly id: string; readonly question: string },
  naturalVersion: string | null = null
): InterviewAnswerResult => ({
  evaluation: evaluationOf(answer, "I worked on a payments API."),
  naturalVersion,
  nextTurn: { ...next, order: 2 },
  status: "answered",
});

// Starts an interview, answers its first question with `answer`, and returns that turn's feedback.
const feedbackOn = async (
  answer: string,
  result: InterviewAnswerResult
): Promise<HTMLElement> => {
  const { page } = await renderInterview({
    answers: [result],
    started: { sessionId: "session-1", turn: firstTurn },
  });
  await userEvent.click(
    within(page).getByRole("button", { name: "Start interview" })
  );
  await userEvent.type(
    await within(page).findByRole("textbox", { name: "Your answer" }),
    answer
  );
  await userEvent.click(
    within(page).getByRole("button", { name: "Submit answer" })
  );
  return within(page).findByRole("region", {
    name: "Tell me about a project you worked on recently.",
  });
};

describe("/interview", () => {
  it("starts an interview and asks its first question", async () => {
    const { page } = await renderInterview({
      started: { sessionId: "session-1", turn: firstTurn },
    });
    expect(page).toHaveTextContent(
      "A text-based software engineering interview. The interviewer asks a question, you answer in English, and each answer is evaluated like any other writing."
    );
    await userEvent.click(
      within(page).getByRole("button", { name: "Start interview" })
    );

    expect(await within(page).findByText("Question 1")).toBeVisible();
    expect(
      within(page).getByRole("heading", {
        name: "Tell me about a project you worked on recently.",
      })
    ).toBeVisible();
  });

  it("answers a turn, shows its Evaluation and asks the next question", async () => {
    const { client, page } = await renderInterview({
      answers: [
        answered("I work in a payments API.", {
          id: "turn-2",
          question: "What was the hardest part?",
        }),
      ],
      started: { sessionId: "session-1", turn: firstTurn },
    });
    await userEvent.click(
      within(page).getByRole("button", { name: "Start interview" })
    );
    await userEvent.type(
      await within(page).findByRole("textbox", { name: "Your answer" }),
      "I work in a payments API."
    );
    await userEvent.click(
      within(page).getByRole("button", { name: "Submit answer" })
    );

    expect(await within(page).findByText("Question 2")).toBeVisible();
    expect(client.answerRequests).toEqual([
      {
        answer: "I work in a payments API.",
        sessionId: "session-1",
        turnId: "turn-1",
      },
    ]);
    const feedback = within(page).getByRole("region", {
      name: "Tell me about a project you worked on recently.",
    });
    expect(feedback).toHaveTextContent("Question 1");
    expect(feedback).toHaveTextContent("I work in a payments API.");
    expect(feedback).toHaveTextContent("One tense mistake.");
    expect(feedback).toHaveTextContent(
      "Corrected versionI worked on a payments API."
    );
    expect(feedback).toHaveTextContent("82Clear");
    expect(
      within(page).getByRole("textbox", { name: "Your answer" })
    ).toHaveValue("");
  });

  it("wraps up after the last answer with every turn's feedback", async () => {
    const { page } = await renderInterview({
      answers: [
        {
          evaluation: evaluationOf("I shipped it.", "I shipped it."),
          naturalVersion: null,
          status: "ended",
        },
      ],
      started: { sessionId: "session-1", turn: firstTurn },
    });
    await userEvent.click(
      within(page).getByRole("button", { name: "Start interview" })
    );
    await userEvent.type(
      await within(page).findByRole("textbox", { name: "Your answer" }),
      "I shipped it."
    );
    await userEvent.click(
      within(page).getByRole("button", { name: "Submit answer" })
    );

    expect(await within(page).findByText("Interview complete.")).toBeVisible();
    expect(
      within(page).getByRole("region", {
        name: "Tell me about a project you worked on recently.",
      })
    ).not.toHaveTextContent("Corrected version");
    await userEvent.click(
      within(page).getByRole("button", { name: "Start a new interview" })
    );
    expect(
      within(page).getByRole("button", { name: "Start interview" })
    ).toBeVisible();
  });

  it("shows how a fluent speaker might phrase an answer, as Grifando did", async () => {
    const feedback = await feedbackOn(
      "I work in a payments API.",
      answered(
        "I work in a payments API.",
        { id: "turn-2", question: "What was the hardest part?" },
        "I'm working on a payments API."
      )
    );

    expect(feedback).toHaveTextContent(
      "More naturallyI'm working on a payments API."
    );
  });

  it("leaves out a natural version that reads as the answer", async () => {
    const feedback = await feedbackOn("I shipped it.", {
      evaluation: evaluationOf("I shipped it.", "I shipped it."),
      naturalVersion: "I shipped it.",
      status: "ended",
    });

    expect(feedback).toHaveTextContent("I shipped it.");
    expect(feedback).not.toHaveTextContent("More naturally");
  });

  it("leaves out the natural version the Enrichment did not record", async () => {
    const feedback = await feedbackOn("I shipped it.", {
      evaluation: evaluationOf("I shipped it.", "I shipped it."),
      naturalVersion: null,
      status: "ended",
    });

    expect(feedback).toHaveTextContent("I shipped it.");
    expect(feedback).not.toHaveTextContent("More naturally");
  });

  it("keeps the answer and shows the route's message when the Enrichment fails", async () => {
    const { page } = await renderInterview({
      answers: [
        {
          evaluationId: "kept",
          message:
            "We couldn't analyze this writing right now. Your text has not been lost — you can try again.",
          status: "failed",
        },
      ],
      started: { sessionId: "session-1", turn: firstTurn },
    });
    await userEvent.click(
      within(page).getByRole("button", { name: "Start interview" })
    );
    await userEvent.type(
      await within(page).findByRole("textbox", { name: "Your answer" }),
      "I work in a payments API."
    );
    await userEvent.click(
      within(page).getByRole("button", { name: "Submit answer" })
    );

    expect(await within(page).findByRole("alert")).toHaveTextContent(
      "We couldn't analyze this writing right now. Your text has not been lost — you can try again."
    );
    expect(
      within(page).getByRole("textbox", { name: "Your answer" })
    ).toHaveValue("I work in a payments API.");
    expect(within(page).getByText("Question 1")).toBeVisible();
  });

  it("ends the interview on request and shows the wrap-up", async () => {
    const { client, page } = await renderInterview({
      started: { sessionId: "session-1", turn: firstTurn },
    });
    await userEvent.click(
      within(page).getByRole("button", { name: "Start interview" })
    );
    await userEvent.click(
      await within(page).findByRole("button", { name: "End interview" })
    );

    expect(await within(page).findByText("Interview complete.")).toBeVisible();
    expect(client.endRequests).toEqual(["session-1"]);
  });

  it("points to setup when the Trainer has no key", async () => {
    const { page } = await renderInterview({
      started: new AcademyRequestError(401, {
        code: "AI_KEY_REQUIRED",
        error: "Set up your AI key to get feedback.",
      }),
    });
    await userEvent.click(
      within(page).getByRole("button", { name: "Start interview" })
    );

    expect(
      await within(page).findByRole("link", { name: "Set up a key" })
    ).toHaveAttribute("href", "/setup");
  });
});

// The answer sheet of a started interview under a Deploy Profile with these caps.
const answerSheetUnder = async (limits: SampleLimits) => {
  render(
    <RouterProvider
      router={createAppRouter({
        academyClient: createInMemoryAcademyClient({
          interview: { started: { sessionId: "session-1", turn: firstTurn } },
          sampleLimits: limits,
        }),
        evaluationClient: createInMemoryEvaluationClient(),
        history: createMemoryHistory({ initialEntries: ["/interview"] }),
      })}
    />
  );
  const page = await screen.findByRole("main");
  await userEvent.click(
    within(page).getByRole("button", { name: "Start interview" })
  );
  return {
    page,
    sheet: await within(page).findByRole("textbox", { name: "Your answer" }),
  };
};

// Grifando capped an answer at 5000 characters; under docs/adr/0006 the Deploy Profile's caps
// size the answer sheet (#196).
describe("/interview answer sheet caps", () => {
  it("stops the answer sheet at the Deploy Profile's character cap", async () => {
    const { page, sheet } = await answerSheetUnder({
      codeMaxCharacters: null,
      sampleMaxBytes: 32_768,
      sampleMaxCharacters: 4000,
    });

    expect(sheet).toHaveAttribute("maxlength", "4000");
    expect(within(page).getByText("0 / 4000")).toBeVisible();
  });

  it("leaves the answer sheet without a character cap when the Deploy Profile has none", async () => {
    const { page, sheet } = await answerSheetUnder({
      codeMaxCharacters: null,
      sampleMaxBytes: 32_768,
      sampleMaxCharacters: null,
    });

    expect(sheet).not.toHaveAttribute("maxlength");
    expect(within(page).getByText("0 characters")).toBeVisible();
    await userEvent.type(sheet, "I");
    expect(within(page).getByText("1 character")).toBeVisible();
  });
});
