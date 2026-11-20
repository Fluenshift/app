// Ported from Grifando's characterization of its /today page (74dbb9f,
// migration/characterization/grifando/files/src/app/pages.characterization.test.ts), which hands
// TodaySession today's challenge. Under docs/adr/0025 the route test of apps/server checks the
// challenge and its bias; this screen test checks what the page renders from the challenge it
// reads.
import type { DailyChallenge } from "@fluenshift/contract";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
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
