// Ported from Grifando's characterization of its /today page (74dbb9f,
// migration/characterization/grifando/files/src/app/pages.characterization.test.ts), which hands
// TodaySession today's challenge. Under docs/adr/0025 the route test of apps/server checks the
// challenge and its bias; this screen test checks what the page renders from the challenge it
// reads.
import type { DailyChallenge } from "@fluenshift/contract";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { createInMemoryAcademyClient } from "../features/academy/in-memory-academy-client";
import { createInMemoryEvaluationClient } from "../features/evaluations/in-memory-evaluation-client";
import { createAppRouter } from "../router";

const renderToday = (dailyChallenge: DailyChallenge) =>
  render(
    <RouterProvider
      router={createAppRouter({
        academyClient: createInMemoryAcademyClient({ dailyChallenge }),
        evaluationClient: createInMemoryEvaluationClient(),
        history: createMemoryHistory({ initialEntries: ["/today"] }),
      })}
    />
  );

describe("/today", () => {
  it("hands TodaySession today's challenge, biased toward the visitor's active categories", async () => {
    const plain = renderToday({
      promptText:
        "Explain what an API is to someone with no programming background.",
      promptType: "DAILY_CHALLENGE",
    });
    const page = await screen.findByRole("main");
    expect(page).toHaveTextContent(
      "One short piece of writing, then a review mixing today’s mistakes with the ones you’re starting to forget."
    );
    expect(within(page).getByRole("heading", { level: 1 })).toHaveTextContent(
      "Today"
    );
    const [write, review] = within(
      within(page).getByRole("list", { name: "Session steps" })
    ).getAllByRole("listitem");
    expect(write).toHaveTextContent("1 Write");
    expect(write).toHaveAttribute("aria-current", "step");
    expect(review).toHaveTextContent("2 Review");
    expect(review).not.toHaveAttribute("aria-current");
    expect(within(page).getByRole("complementary")).toHaveTextContent(
      "PromptExplain what an API is to someone with no programming background."
    );
    expect(
      within(page).getByRole("textbox", { name: "Your answer" })
    ).toHaveAttribute("placeholder", "Write your answer here...");
    plain.unmount();

    renderToday({
      promptText:
        "Describe a bug you recently solved and how you found the root cause.",
      promptType: "DAILY_CHALLENGE",
    });
    expect(await screen.findByRole("complementary")).toHaveTextContent(
      "PromptDescribe a bug you recently solved and how you found the root cause."
    );
  });
});

// Grifando's TodaySession (74dbb9f): after today's writing, "Continue to review" opens a practice
// set that starts with the patterns of that writing (docs/adr/0025, decision 5).
describe("/today review", () => {
  it("continues to a review that opens with the patterns of today's writing", async () => {
    const client = createInMemoryAcademyClient({
      dailyChallenge: {
        promptText:
          "Explain what an API is to someone with no programming background.",
        promptType: "DAILY_CHALLENGE",
      },
      exercises: { generated: [] },
      practiceWriting: {
        evaluation: {
          band: "Natural",
          correctedText: "An API lets programs talk.",
          evaluatedAt: "2026-03-05T12:00:00.000Z",
          evaluatedEnglishWordCount: 5,
          findings: [],
          id: "today-1",
          model: "judge-model",
          originalText: "An API lets programs talk.",
          provider: "test",
          rubricVersion: "1",
          score: 100,
          suggestions: [],
          summary: "No errors found.",
        },
        naturalVersion: null,
        occurrences: [],
        status: "evaluated",
      },
    });
    render(
      <RouterProvider
        router={createAppRouter({
          academyClient: client,
          evaluationClient: createInMemoryEvaluationClient(),
          history: createMemoryHistory({ initialEntries: ["/today"] }),
        })}
      />
    );
    const page = await screen.findByRole("main");
    await userEvent.type(
      within(page).getByRole("textbox", { name: "Your answer" }),
      "An API lets programs talk."
    );
    await userEvent.click(
      within(page).getByRole("button", { name: "Get feedback" })
    );
    await userEvent.click(
      await within(page).findByRole("button", { name: "Continue to review" })
    );

    const [, review] = within(
      within(page).getByRole("list", { name: "Session steps" })
    ).getAllByRole("listitem");
    expect(review).toHaveAttribute("aria-current", "step");
    expect(
      await within(page).findByText("No exercises to practice right now")
    ).toBeVisible();
    expect(client.generationRequests).toEqual([
      { afterEvaluationId: "today-1" },
    ]);
  });
});

// Under docs/adr/0006 the Deploy Profile's caps size today's sheet too (#196).
describe("/today sheet caps", () => {
  it("stops today's sheet at the Deploy Profile's character cap", async () => {
    render(
      <RouterProvider
        router={createAppRouter({
          academyClient: createInMemoryAcademyClient({
            dailyChallenge: {
              promptText:
                "Explain what an API is to someone with no programming background.",
              promptType: "DAILY_CHALLENGE",
            },
            sampleLimits: { sampleMaxBytes: 32_768, sampleMaxCharacters: 4000 },
          }),
          evaluationClient: createInMemoryEvaluationClient(),
          history: createMemoryHistory({ initialEntries: ["/today"] }),
        })}
      />
    );
    const page = await screen.findByRole("main");

    expect(
      within(page).getByRole("textbox", { name: "Your answer" })
    ).toHaveAttribute("maxlength", "4000");
  });
});
