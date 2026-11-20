// Ported from Grifando's characterization of its /write page (74dbb9f,
// migration/characterization/grifando/files/src/app/pages.characterization.test.ts), which takes
// its challenge and heading from the query. Under docs/adr/0025 the SPA reads `promptId` and
// `mode` from its own URL: a technical prompt comes from the bank of packages/core, and the daily
// challenge from the Academy client, whose route test covers /today.
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createInMemoryAcademyClient } from "../features/academy/in-memory-academy-client";
import { createInMemoryEvaluationClient } from "../features/evaluations/in-memory-evaluation-client";
import { createAppRouter } from "../router";

// The page's heading and what its sheet's aside shows: the Practice Prompt, or no prompt at all.
const read = async (url: string) => {
  const view = render(
    <RouterProvider
      router={createAppRouter({
        academyClient: createInMemoryAcademyClient({
          dailyChallenge: {
            promptText:
              "Explain what an API is to someone with no programming background.",
            promptType: "DAILY_CHALLENGE",
          },
        }),
        evaluationClient: createInMemoryEvaluationClient(),
        history: createMemoryHistory({ initialEntries: [url] }),
      })}
    />
  );
  const page = await screen.findByRole("main");
  const aside = within(page).queryByRole("complementary");
  const seen = {
    challenge:
      aside === null ||
      within(aside).queryByRole("heading", { name: "Prompt" }) === null
        ? undefined
        : within(aside).getByRole("paragraph").textContent,
    title: within(page).queryByRole("heading", { level: 1 })?.textContent,
  };
  view.unmount();
  return seen;
};

describe("/write", () => {
  it("takes its challenge and heading from the query", async () => {
    expect(await read("/write")).toEqual({
      challenge: undefined,
      title: "Write",
    });
    expect(await read("/write?promptId=missing")).toEqual({
      challenge: undefined,
      title: "Write",
    });
    expect(await read("/write?promptId=backend-1")).toEqual({
      challenge:
        "Explain the difference between synchronous and asynchronous request handling.",
      title: "Technical English",
    });
    expect(await read("/write?mode=daily")).toEqual({
      challenge:
        "Explain what an API is to someone with no programming background.",
      title: "Today’s challenge",
    });
  });
});
