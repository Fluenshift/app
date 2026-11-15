// Characterization of apps/web/src/routes/progress.tsx at the PE baseline: how a finding rate
// below 0.1 per 100 words reads, which -progress.test.tsx never checks.
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";

import type { Evaluation } from "@/features/evaluations/evaluation-client";
import { createInMemoryEvaluationClient } from "@/features/evaluations/in-memory-evaluation-client";
import { createAppRouter } from "@/router";

const longEvaluation: Evaluation = {
  band: "Natural",
  correctedText: "A long sample.",
  evaluatedAt: "2026-09-14T12:00:00.000Z",
  evaluatedEnglishWordCount: 2000,
  findings: [
    {
      category: "Spelling",
      correction: "test",
      explanation: "The letters are reversed.",
      originalText: "tset",
      severity: "Minor",
    },
  ],
  id: "long-evaluation",
  model: "openai/gpt-5.6-terra",
  originalText: "A long sample.",
  provider: "OpenRouter",
  rubricVersion: "1",
  score: 95,
  suggestions: [],
  summary: "One spelling correction in a long sample.",
};

test("Progress shows a finding rate below 0.1 as <0.1", async () => {
  render(
    <RouterProvider
      router={createAppRouter({
        evaluationClient: createInMemoryEvaluationClient({
          now: () => new Date("2026-09-15T12:00:00.000Z"),
          seededEvaluations: [longEvaluation],
        }),
        history: createMemoryHistory({ initialEntries: ["/progress"] }),
      })}
    />
  );

  expect(
    await screen.findByRole("region", { name: "Finding rate" })
  ).toHaveTextContent("<0.1 per 100 words");
});
