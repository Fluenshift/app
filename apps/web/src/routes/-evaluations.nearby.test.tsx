import type { Evaluation } from "@grifando/contract";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import { expect, test } from "vitest";

import { createInMemoryEvaluationClient } from "../features/evaluations/in-memory-evaluation-client";
import { createAppRouter } from "../router";

const evaluationOn = (day: number): Evaluation => ({
  band: "Clear",
  correctedText: `Sample ${day}.`,
  evaluatedAt: `2026-09-${String(day).padStart(2, "0")}T12:00:00.000Z`,
  evaluatedEnglishWordCount: 2,
  findings: [],
  id: `evaluation-${day}`,
  model: "openai/gpt-5.6-terra",
  originalText: `Sample ${day}.`,
  provider: "OpenRouter",
  rubricVersion: "1",
  score: 80,
  suggestions: [],
  summary: `Summary of day ${day}`,
});

test("the Nearby evaluations rail leaves out the open Evaluation and keeps the five newest others", async () => {
  const router = createAppRouter({
    evaluationClient: createInMemoryEvaluationClient({
      seededEvaluations: [1, 2, 3, 4, 5, 6, 7].map(evaluationOn),
    }),
    history: createMemoryHistory({
      initialEntries: ["/evaluations/evaluation-6"],
    }),
  });

  render(<RouterProvider router={router} />);

  const nearby = await screen.findByRole("list", {
    name: "Nearby Evaluations",
  });
  expect(
    within(nearby)
      .getAllByRole("link")
      .map((link) => link.getAttribute("href"))
  ).toEqual([
    "/evaluations/evaluation-7",
    "/evaluations/evaluation-5",
    "/evaluations/evaluation-4",
    "/evaluations/evaluation-3",
    "/evaluations/evaluation-2",
  ]);
});
