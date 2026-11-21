// Grifando's NavLinks (74dbb9f), ported from source under docs/adr/0025, decision 5, as the
// Academy's own navigation on its screens: Overview opens /academy, and Key shows in the hosted
// profile only (docs/adr/0034). Explain code joined it with its screen (docs/adr/0038).
import type { DeployProfile } from "@fluenshift/contract";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { createInMemoryAcademyClient } from "../features/academy/in-memory-academy-client";
import { createInMemoryEvaluationClient } from "../features/evaluations/in-memory-evaluation-client";
import { createAppRouter } from "../router";

const renderAt = (url: string, deployProfile: DeployProfile = "local") =>
  render(
    <RouterProvider
      router={createAppRouter({
        academyClient: createInMemoryAcademyClient({
          vocabulary: [],
        }),
        deployProfile,
        evaluationClient: createInMemoryEvaluationClient(),
        history: createMemoryHistory({ initialEntries: [url] }),
      })}
    />
  );

describe("Academy navigation", () => {
  it("links every Academy screen and marks the current one", async () => {
    renderAt("/vocabulary");
    const navigation = await screen.findByRole("navigation", {
      name: "Academy",
    });
    const links = within(navigation).getAllByRole("link");

    expect(
      links.map((link) => [link.textContent, link.getAttribute("href")])
    ).toEqual([
      ["Overview", "/academy"],
      ["Today", "/today"],
      ["Write", "/write"],
      ["Technical", "/technical"],
      ["Explain code", "/explain-code"],
      ["Interview", "/interview"],
      ["Exercises", "/exercises"],
      ["Mistakes", "/mistakes"],
      ["Vocabulary", "/vocabulary"],
    ]);
    expect(
      links
        .filter((link) => link.getAttribute("aria-current") === "page")
        .map((link) => link.textContent)
    ).toEqual(["Vocabulary"]);
  });

  it("ends with Grifando's Key entry in the hosted profile", async () => {
    renderAt("/vocabulary", "hosted");
    const navigation = await screen.findByRole("navigation", {
      name: "Academy",
    });

    expect(
      within(navigation)
        .getAllByRole("link")
        .map((link) => [link.textContent, link.getAttribute("href")])
    ).toEqual([
      ["Overview", "/academy"],
      ["Today", "/today"],
      ["Write", "/write"],
      ["Technical", "/technical"],
      ["Explain code", "/explain-code"],
      ["Interview", "/interview"],
      ["Exercises", "/exercises"],
      ["Mistakes", "/mistakes"],
      ["Vocabulary", "/vocabulary"],
      ["Key", "/settings"],
    ]);
  });

  it("names the current page in a disclosure that opens the full list", async () => {
    renderAt("/technical");
    const navigation = await screen.findByRole("navigation", {
      name: "Academy",
    });
    const menu = within(navigation).getByRole("button", {
      name: "Menu Technical",
    });
    expect(menu).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(menu);

    expect(menu).toHaveAttribute("aria-expanded", "true");
    expect(within(navigation).getAllByRole("link")).toHaveLength(18);
  });

  it("stays off the Evaluation screens", async () => {
    renderAt("/setup");
    await screen.findByRole("heading", { level: 1, name: "Setup & privacy" });

    expect(
      screen.queryByRole("navigation", { name: "Academy" })
    ).not.toBeInTheDocument();
  });
});
