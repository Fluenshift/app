// Ported from Grifando's characterization of its / page, the dashboard (74dbb9f,
// migration/characterization/grifando/files/src/app/pages.characterization.test.ts), at /academy
// under docs/adr/0025. The route test of apps/server checks what the dashboard reads; this screen
// test checks what the page renders from it. A writing session is a practice-origin Writing
// Sample (docs/adr/0004), and the averaged model scores are gone (docs/adr/0002).
import type { AcademyDashboard } from "@fluenshift/contract";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { createInMemoryAcademyClient } from "../features/academy/in-memory-academy-client";
import { createInMemoryEvaluationClient } from "../features/evaluations/in-memory-evaluation-client";
import { createAppRouter } from "../router";

const renderDashboard = async (academyDashboard: AcademyDashboard) => {
  const view = render(
    <RouterProvider
      router={createAppRouter({
        academyClient: createInMemoryAcademyClient({ academyDashboard }),
        evaluationClient: createInMemoryEvaluationClient(),
        history: createMemoryHistory({ initialEntries: ["/academy"] }),
      })}
    />
  );
  const page = await screen.findByRole("main");
  return {
    page,
    text: (page.textContent ?? "").replaceAll(/\s+/gu, " "),
    view,
  };
};

const empty: AcademyDashboard = {
  dailyChallenge: {
    promptText:
      "Explain what an API is to someone with no programming background.",
    promptType: "DAILY_CHALLENGE",
  },
  dueCount: 0,
  progress: {
    exerciseAccuracy: null,
    exercisesCompleted: 0,
    writingSamplesCompleted: 0,
  },
  recentPatterns: [],
  recentWriting: [],
  recommendation: null,
  streak: { activeToday: false, current: 0, longest: 0 },
  weakAreas: [],
};

describe("/academy", () => {
  it("feeds the dashboard's streak, progress, weak areas and recent lists", async () => {
    const before = await renderDashboard(empty);
    expect(before.text).toContain("Practice once today to start a streak.");
    expect(before.text).toContain("0Writing samples");
    expect(before.text).toContain("0Exercises done");
    expect(before.text).toContain("—Exercise accuracy · aiming for about 70%");
    expect(before.text).toContain(
      "No weak areas yet — write something to get started."
    );
    expect(before.text).toContain("No mistakes recorded yet.");
    expect(before.text).toContain("No writing samples yet.");
    expect(before.text).toContain(
      "Explain what an API is to someone with no programming background."
    );
    expect(before.text).toContain(
      "Write something first — exercises are generated from mistakes found in your own writing."
    );
    expect(before.text).not.toContain("Average scores");
    before.view.unmount();

    const after = await renderDashboard({
      dailyChallenge: {
        promptText:
          "Describe a bug you recently solved and how you found the root cause.",
        promptType: "DAILY_CHALLENGE",
      },
      dueCount: 1,
      progress: {
        exerciseAccuracy: { correct: 2, total: 3 },
        exercisesCompleted: 3,
        writingSamplesCompleted: 4,
      },
      recentPatterns: [
        {
          exampleCorrection: "depend-on correction",
          exampleOriginal: "depend-on original",
          id: "depend-on",
        },
      ],
      recentWriting: [0, 1, 2].map((days) => ({
        evaluatedAt: `2026-03-0${5 - days}T10:00:00.000Z`,
        id: `written-${days}`,
        originalText: `Text written ${days} days ago.`,
      })),
      recommendation: {
        category: "PREPOSITIONS",
        exampleCorrection: "depend-on correction",
        exampleOriginal: "depend-on original",
        occurrenceCount: 3,
      },
      streak: { activeToday: true, current: 4, longest: 4 },
      weakAreas: [{ category: "PREPOSITIONS", count: 4, percentage: 100 }],
    });
    expect(after.text).toContain("4-day streak · longest 4");
    expect(after.text).toContain("Today counts already.");
    expect(after.text).toContain("4Writing samples");
    expect(after.text).toContain("3Exercises done");
    expect(after.text).toContain(
      "67%Accuracy over your last 3 · aiming for about 70%"
    );
    expect(after.text).toContain("Prepositions100% of mistakes");
    expect(after.text).toContain(
      "depend-on original → corrected todepend-on correction"
    );
    expect(
      within(after.page)
        .getAllByText(/^Text written \d days ago\.$/u)
        .map((excerpt) => excerpt.textContent)
    ).toEqual([
      "Text written 0 days ago.",
      "Text written 1 days ago.",
      "Text written 2 days ago.",
    ]);
    expect(after.text).toContain(
      "1 pattern is due for review — you're likely to be forgetting it."
    );
    expect(after.text).toContain("You've mixed up Prepositions 3 times.");
    expect(after.text).toContain(
      "Describe a bug you recently solved and how you found the root cause."
    );
  });

  it("joins the primary navigation", async () => {
    const { page } = await renderDashboard(empty);
    expect(
      within(page).getByRole("link", { name: "Go to exercises" })
    ).toHaveAttribute("href", "/exercises");
    const navigation = screen.getByRole("navigation", {
      name: "Primary navigation",
    });
    expect(
      within(navigation).getByRole("link", { name: "Academy" })
    ).toHaveAttribute("href", "/academy");
  });
});

// Grifando's LiveSpecimen (74dbb9f), ported from source under docs/adr/0025, decision 5.
describe("/academy specimen", () => {
  it("shows a proofed example and swaps its scenario", async () => {
    const { page } = await renderDashboard(empty);
    const scenarios = within(page).getByRole("group", {
      name: "Example scenario",
    });
    const standup = within(scenarios).getByRole("button", {
      name: "Standup update",
    });
    expect(standup).toHaveAttribute("aria-pressed", "true");
    expect(page).toHaveTextContent(
      "Example of a proofed paragraph: Yesterday I fixed the bug on the login page"
    );
    expect(page).toHaveTextContent(
      '"will to work" should be "will work". After "will" the verb comes bare, with no "to".'
    );

    await userEvent.click(
      within(scenarios).getByRole("button", { name: "Code review comment" })
    );

    expect(standup).toHaveAttribute("aria-pressed", "false");
    expect(page).toHaveTextContent(
      '"too much things" should be "too many things".'
    );
  });
});
