import type { Evaluation } from "@grifando/contract";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

import { createInMemoryEvaluationClient } from "../features/evaluations/in-memory-evaluation-client";
import { createAppRouter } from "../router";

const NOW = "2026-09-15T12:00:00.000Z";

const retained = (
  id: string,
  evaluatedAt: string,
  evaluatedEnglishWordCount: number,
  findingCount: number
): Evaluation => ({
  band: "Clear",
  correctedText: `Corrected ${id}.`,
  evaluatedAt,
  evaluatedEnglishWordCount,
  findings: Array.from({ length: findingCount }, () => ({
    category: "Spelling",
    correction: "test",
    explanation: "The letters are reversed.",
    originalText: "tset",
    severity: "Minor",
  })),
  id,
  model: "openai/gpt-5.6-terra",
  originalText: `Original ${id}.`,
  provider: "OpenRouter",
  rubricVersion: "1",
  score: 80,
  suggestions: [],
  summary: `Summary of ${id}`,
});

const renderDesk = (seededEvaluations: readonly Evaluation[]) => {
  render(
    <RouterProvider
      router={createAppRouter({
        evaluationClient: createInMemoryEvaluationClient({
          now: () => new Date(NOW),
          seededEvaluations,
        }),
        history: createMemoryHistory({ initialEntries: ["/"] }),
      })}
    />
  );
};

const writingSample = "Explain why the tset fails and how I can fix it.";

const scenario = {
  correctedText: { kind: "submitted-writing" },
  detail: {
    band: "Clear",
    evaluatedAt: "2026-09-01T12:00:00.000Z",
    evaluatedEnglishWordCount: 11,
    findings: [
      {
        category: "Spelling",
        correction: "test",
        explanation: "The letters are reversed.",
        originalText: "tset",
        severity: "Minor",
      },
    ],
    model: "openai/gpt-5.6-terra",
    provider: "OpenRouter",
    rubricVersion: "1",
    score: 82,
    suggestions: [],
    summary: "One spelling correction.",
  },
  kind: "created",
} as const;

describe("Writing Desk details", () => {
  test("lists the three newest Evaluations as recent", async () => {
    renderDesk([
      retained("first", "2026-09-11T12:00:00.000Z", 10, 0),
      retained("second", "2026-09-12T12:00:00.000Z", 10, 0),
      retained("third", "2026-09-13T12:00:00.000Z", 10, 0),
      retained("fourth", "2026-09-14T12:00:00.000Z", 10, 0),
    ]);

    const recent = await screen.findByRole("complementary", {
      name: "Recent evaluations",
    });
    expect(
      within(recent)
        .getAllByRole("listitem")
        .map((item) => within(item).getByText(/^Summary of/u).textContent)
    ).toEqual(["Summary of fourth", "Summary of third", "Summary of second"]);
  });

  test("counts only the last 30 days in its finding rate", async () => {
    renderDesk([
      retained("recent", "2026-09-14T12:00:00.000Z", 10, 1),
      retained("old", "2026-08-01T12:00:00.000Z", 1, 1),
    ]);

    const recent = await screen.findByRole("complementary", {
      name: "Recent evaluations",
    });
    expect(within(recent).getByText("10 / 100 words")).toBeInTheDocument();
  });

  test("shows a finding rate below 0.1 as <0.1", async () => {
    renderDesk([retained("long", "2026-09-14T12:00:00.000Z", 2000, 1)]);

    const recent = await screen.findByRole("complementary", {
      name: "Recent evaluations",
    });
    expect(within(recent).getByText("<0.1 / 100 words")).toBeInTheDocument();
  });

  test("a second submission in the same moment sends nothing", async () => {
    const client = createInMemoryEvaluationClient({ attempts: [scenario] });
    const submitted: string[] = [];
    render(
      <RouterProvider
        router={createAppRouter({
          evaluationClient: {
            ...client,
            evaluateWriting: (sample) => {
              submitted.push(sample);
              return client.evaluateWriting(sample);
            },
          },
          history: createMemoryHistory({ initialEntries: ["/"] }),
        })}
      />
    );

    const input = await screen.findByLabelText("Writing Sample");
    fireEvent.change(input, { target: { value: writingSample } });
    const form = input.closest("form");
    if (form === null) {
      throw new Error("The Writing Sample has no form");
    }
    // Both submissions reach the form before React renders the pending state.
    act(() => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true })
      );
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true })
      );
    });

    expect(
      await screen.findByRole("button", { name: "Evaluate again" })
    ).toBeInTheDocument();
    expect(submitted).toEqual([writingSample]);
  });

  test("accepting a Correction after the draft changed replaces the first occurrence of its text", async () => {
    const user = userEvent.setup();
    render(
      <RouterProvider
        router={createAppRouter({
          evaluationClient: createInMemoryEvaluationClient({
            attempts: [scenario],
          }),
          history: createMemoryHistory({ initialEntries: ["/"] }),
        })}
      />
    );

    const input = await screen.findByLabelText("Writing Sample");
    await user.type(input, writingSample);
    await user.click(screen.getByRole("button", { name: "Evaluate writing" }));
    await screen.findByRole("button", { name: "Evaluate again" });
    await user.clear(input);
    await user.type(input, `Note: ${writingSample}`);

    await user.click(
      await screen.findByRole("button", { name: "Finding: tset" })
    );
    await user.click(screen.getByRole("button", { name: /accept/iu }));

    expect(input).toHaveValue(
      "Note: Explain why the test fails and how I can fix it."
    );
  });
});
