// Ported from Grifando's characterization of its /mistakes page, the Mistake Notebook (74dbb9f,
// migration/characterization/grifando/files/src/app/pages.characterization.test.ts), under
// docs/adr/0005 and docs/adr/0025. The route test of apps/server checks the patterns, their
// derived state and the breakdowns; this screen test checks what the page renders from them, and
// the time range and origin filters it applies from its own URL.
import type { MistakeNotebook, NotebookPattern } from "@fluenshift/contract";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createInMemoryAcademyClient } from "../features/academy/in-memory-academy-client";
import { createInMemoryEvaluationClient } from "../features/evaluations/in-memory-evaluation-client";
import { createAppRouter } from "../router";

const textOf = async (url: string, mistakeNotebook: MistakeNotebook) => {
  const view = render(
    <RouterProvider
      router={createAppRouter({
        academyClient: createInMemoryAcademyClient({ mistakeNotebook }),
        evaluationClient: createInMemoryEvaluationClient(),
        history: createMemoryHistory({ initialEntries: [url] }),
      })}
    />
  );
  const page = await screen.findByRole("main");
  const text = page.textContent ?? "";
  view.unmount();
  return text.replaceAll(/\s+/gu, " ");
};

const pattern = (
  overrides: Partial<NotebookPattern> & Pick<NotebookPattern, "category" | "id">
): NotebookPattern => ({
  due: false,
  exampleCorrection: `${overrides.id} correction`,
  exampleOriginal: `${overrides.id} original`,
  fading: false,
  fromPortuguese: false,
  lastSeenAt: "2026-02-28T12:00:00.000Z",
  masteryLevel: "ACTIVE",
  occurrenceCount: 1,
  ...overrides,
});

describe("/mistakes", () => {
  it("shows each pattern once with its mastery, the category breakdown and the due count", async () => {
    const empty = await textOf("/mistakes", {
      breakdown: { allTime: [], last30Days: [] },
      patterns: [],
    });
    expect(empty).toContain("No mistakes recorded yet.");
    expect(empty).toContain("0 patterns");
    expect(empty).toContain("No mistakes yet. Write something to get started.");

    const text = await textOf("/mistakes", {
      breakdown: {
        allTime: [
          { category: "PREPOSITIONS", count: 2, percentage: 66.7 },
          { category: "ARTICLES", count: 1, percentage: 33.3 },
        ],
        last30Days: [{ category: "PREPOSITIONS", count: 2, percentage: 100 }],
      },
      patterns: [
        pattern({
          category: "PREPOSITIONS",
          due: true,
          fromPortuguese: true,
          id: "depend-on",
          occurrenceCount: 2,
        }),
        pattern({
          category: "ARTICLES",
          due: true,
          fading: true,
          id: "a-an",
          masteryLevel: "MASTERED",
        }),
      ],
    });
    expect(text).toContain("2 patterns are due for review.");
    expect(text).toContain("Practice due patterns");
    expect(text).toContain("Prepositions66.7%");
    expect(text).toContain("Articles33.3%");
    expect(text).toContain("2 patterns");
    expect(text).toContain(
      "depend-on original → corrected todepend-on correction"
    );
    expect(text).toContain("PrepositionsActive2× · last seen");
    expect(text).toContain("ArticlesFading1× · last seen");
  });

  it("narrows the breakdown to 30 days and the patterns to those from Portuguese", async () => {
    const notebook: MistakeNotebook = {
      breakdown: {
        allTime: [
          { category: "PREPOSITIONS", count: 1, percentage: 50 },
          { category: "ARTICLES", count: 1, percentage: 50 },
        ],
        last30Days: [{ category: "PREPOSITIONS", count: 1, percentage: 100 }],
      },
      patterns: [
        pattern({
          category: "PREPOSITIONS",
          fromPortuguese: true,
          id: "depend-on",
        }),
        pattern({ category: "ARTICLES", id: "a-an" }),
      ],
    };

    const lastMonth = await textOf("/mistakes?window=30d", notebook);
    expect(lastMonth).toContain("Prepositions100%");
    expect(lastMonth).not.toContain("Articles50%");

    const fromPortuguese = await textOf("/mistakes?origin=pt", notebook);
    expect(fromPortuguese).toContain("1 pattern");
    expect(fromPortuguese).toContain("depend-on original");
    expect(fromPortuguese).not.toContain("a-an original");

    expect(await textOf("/mistakes?origin=pt&window=30d", notebook)).toContain(
      "Prepositions100%"
    );
    expect(
      await textOf("/mistakes?origin=pt", {
        ...notebook,
        patterns: notebook.patterns.map((entry) => ({
          ...entry,
          fromPortuguese: false,
        })),
      })
    ).toContain("No mistakes flagged as coming from Portuguese yet.");
  });
});
