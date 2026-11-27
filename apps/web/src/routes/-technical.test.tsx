// Grifando's /technical page (74dbb9f): the technical Practice Prompts by Technical Category,
// each opening /write with its prompt. It reads no repository, so it ports from source under
// docs/adr/0025, decision 5; the bank is packages/core's.
import { TECHNICAL_CATEGORIES } from "@grifando/contract";
import { TECHNICAL_PROMPTS } from "@grifando/core/technical-prompts";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createInMemoryEvaluationClient } from "../features/evaluations/in-memory-evaluation-client";
import { createAppRouter } from "../router";

describe("/technical", () => {
  it("lists every technical prompt under its category, each opening /write", async () => {
    render(
      <RouterProvider
        router={createAppRouter({
          evaluationClient: createInMemoryEvaluationClient(),
          history: createMemoryHistory({ initialEntries: ["/technical"] }),
        })}
      />
    );
    const page = await screen.findByRole("main");
    expect(page).toHaveTextContent(
      "Practice writing about the topics developers actually explain. Pick a prompt to start."
    );
    expect(
      within(page).getByRole("heading", { level: 1, name: "Technical English" })
    ).toBeVisible();
    expect(
      within(page)
        .getAllByRole("heading", { level: 2 })
        .map((heading) => heading.textContent)
    ).toEqual([
      "Backend",
      "Frontend",
      "DevOps",
      "Databases",
      "Cloud",
      "Architecture",
      "Algorithms",
      "Testing",
      "Git",
      "GitHub",
      "Code Review",
      "Security",
      "AI",
      "System Design",
    ]);
    expect(TECHNICAL_CATEGORIES).toHaveLength(14);

    // The Academy's own navigation links the screens; every other link opens a prompt.
    const navigation = within(page).getByRole("navigation", {
      name: "Academy",
    });
    const links = within(page)
      .getAllByRole("link")
      .filter((link) => !navigation.contains(link));
    expect(links).toHaveLength(TECHNICAL_PROMPTS.length);
    const backend = within(page).getByRole("link", {
      name: "Explain the difference between synchronous and asynchronous request handling.",
    });
    expect(backend).toHaveAttribute("href", "/write?promptId=backend-1");
  });
});
