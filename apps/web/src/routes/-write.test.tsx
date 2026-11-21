// Ported from Grifando's characterization of its /write page (74dbb9f,
// migration/characterization/grifando/files/src/app/pages.characterization.test.ts), which takes
// its challenge and heading from the query. Under docs/adr/0025 the SPA reads `promptId` and
// `mode` from its own URL: a technical prompt comes from the bank of packages/core, and the daily
// challenge from the Academy client, whose route test covers /today.
import type {
  DeployProfile,
  Evaluation,
  PracticeWritingResult,
  SampleLimits,
} from "@fluenshift/contract";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { AcademyRequestError } from "../features/academy/academy-client";
import { createInMemoryAcademyClient } from "../features/academy/in-memory-academy-client";
import { createInMemoryEvaluationClient } from "../features/evaluations/in-memory-evaluation-client";
import { createAppRouter } from "../router";

// The page's heading, what its sheet's aside shows, and the challenge the route hands
// PracticeWriting (the characterization's initialChallenge prop).
const read = async (url: string) => {
  const router = createAppRouter({
    academyClient: createInMemoryAcademyClient({
      dailyChallenge: {
        promptText:
          "Explain what an API is to someone with no programming background.",
        promptType: "DAILY_CHALLENGE",
      },
    }),
    evaluationClient: createInMemoryEvaluationClient(),
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  const view = render(<RouterProvider router={router} />);
  const page = await screen.findByRole("main");
  const aside = within(page).queryByRole("complementary");
  const seen = {
    challenge:
      aside === null ||
      within(aside).queryByRole("heading", { name: "Prompt" }) === null
        ? undefined
        : within(aside).getByRole("paragraph").textContent,
    initialChallenge: router.state.matches.find(
      (match) => match.routeId === "/write"
    )?.loaderData,
    title: within(page).queryByRole("heading", { level: 1 })?.textContent,
  };
  view.unmount();
  return seen;
};

describe("/write", () => {
  it("takes its challenge and heading from the query", async () => {
    expect(await read("/write")).toEqual({
      challenge: undefined,
      initialChallenge: undefined,
      title: "Write",
    });
    expect(await read("/write?promptId=missing")).toEqual({
      challenge: undefined,
      initialChallenge: undefined,
      title: "Write",
    });
    expect(await read("/write?promptId=backend-1")).toEqual({
      challenge:
        "Explain the difference between synchronous and asynchronous request handling.",
      initialChallenge: {
        promptText:
          "Explain the difference between synchronous and asynchronous request handling.",
        promptType: "TECHNICAL",
        technicalCategory: "BACKEND",
      },
      title: "Technical English",
    });
    expect(await read("/write?mode=daily")).toEqual({
      challenge:
        "Explain what an API is to someone with no programming background.",
      initialChallenge: {
        promptText:
          "Explain what an API is to someone with no programming background.",
        promptType: "DAILY_CHALLENGE",
      },
      title: "Today’s challenge",
    });
  });
});

const evaluation: Evaluation = {
  band: "Clear",
  correctedText: "I went home.",
  evaluatedAt: "2026-03-05T12:00:00.000Z",
  evaluatedEnglishWordCount: 3,
  findings: [
    {
      byteEnd: 6,
      byteStart: 2,
      category: "Verb form/tense",
      correction: "went",
      explanation: "'Go' has an irregular past: 'went'.",
      originalText: "goed",
      severity: "Moderate",
    },
  ],
  id: "practice-1",
  model: "judge-model",
  originalText: "I goed home.",
  provider: "test",
  rubricVersion: "1",
  score: 76,
  suggestions: [],
  summary: "One verb form mistake.",
};

const evaluated: PracticeWritingResult = {
  evaluation,
  occurrences: [
    {
      category: "VERB_TENSE",
      correctedSpan: "went",
      example: "I went home early.",
      explanation: "'Go' has an irregular past: 'went'.",
      findingPosition: 0,
      id: "occurrence-1",
      l1Transfer: true,
      originalSpan: "goed",
      severity: "ERROR",
    },
  ],
  naturalVersion: "I went back home.",
  status: "evaluated",
};

const renderWrite = async (
  practiceWriting: PracticeWritingResult | AcademyRequestError,
  deployProfile: DeployProfile = "local"
) => {
  const client = createInMemoryAcademyClient({
    practiceWriting,
    vocabulary: [],
  });
  render(
    <RouterProvider
      router={createAppRouter({
        academyClient: client,
        deployProfile,
        evaluationClient: createInMemoryEvaluationClient(),
        history: createMemoryHistory({ initialEntries: ["/write"] }),
      })}
    />
  );
  const page = await screen.findByRole("main");
  await userEvent.type(
    within(page).getByRole("textbox", { name: "Your text" }),
    "I goed home."
  );
  return { client, page };
};

// Grifando's WritingCoach and WritingResults (74dbb9f), ported from source under docs/adr/0025,
// decision 5, onto a practice Evaluation as docs/adr/0026 decides.
describe("/write practice writing", () => {
  it("evaluates the text and shows Grifando's results on the Evaluation", async () => {
    const { client, page } = await renderWrite(evaluated);
    await userEvent.click(
      within(page).getByRole("button", { name: "Get feedback" })
    );

    const results = await within(page).findByRole("region", {
      name: "Your writing",
    });
    expect(client.writeRequests).toEqual(["I goed home."]);
    expect(results).toHaveTextContent("1 mark");
    expect(results).toHaveTextContent("I goed home.");
    expect(results).toHaveTextContent("One verb form mistake.");
    const notes = within(page).getByRole("region", { name: "Notes" });
    expect(notes).toHaveTextContent(
      "IncorrectVerb tenseFrom Portuguesegoed → corrected towent'Go' has an irregular past: 'went'.“I went home early.”Save to vocabulary"
    );
    expect(
      within(page).getByRole("region", { name: "Corrected version" })
    ).toHaveTextContent("I went home.");
    expect(
      within(page).getByRole("region", { name: "Score" })
    ).toHaveTextContent("76Clear");
    expect(
      within(page).getByRole("link", { name: "Open the Evaluation" })
    ).toHaveAttribute("href", "/evaluations/practice-1");
  });

  it("notes a Finding the Enrichment left without an Occurrence", async () => {
    const { page } = await renderWrite({
      evaluation: {
        ...evaluation,
        findings: [
          {
            byteEnd: 6,
            byteStart: 2,
            category: "Clarity",
            correction: "went",
            explanation: "Say what happened plainly.",
            originalText: "goed",
            severity: "Minor",
          },
        ],
      },
      naturalVersion: null,
      occurrences: [],
      status: "evaluated",
    });
    await userEvent.click(
      within(page).getByRole("button", { name: "Get feedback" })
    );

    const notes = await within(page).findByRole("region", { name: "Notes" });
    expect(notes).toHaveTextContent(
      "IncorrectClaritygoed → corrected towentSay what happened plainly."
    );
    expect(notes).not.toHaveTextContent("Nothing to correct here");
  });

  it("shows the natural version beside the corrected version, as Grifando did", async () => {
    const { page } = await renderWrite(evaluated);
    await userEvent.click(
      within(page).getByRole("button", { name: "Get feedback" })
    );

    await within(page).findByRole("region", { name: "Corrected version" });
    expect(
      within(page).queryByRole("region", { name: "Natural version" })
        ?.textContent
    ).toBe(
      "Natural versionHow a fluent speaker might phrase the same idea — one option, not the only correct way to say it.I went back home."
    );
  });

  it("leaves out the natural version when the Enrichment recorded none", async () => {
    const { page } = await renderWrite({ ...evaluated, naturalVersion: null });
    await userEvent.click(
      within(page).getByRole("button", { name: "Get feedback" })
    );

    expect(
      await within(page).findByRole("region", { name: "Corrected version" })
    ).toBeVisible();
    expect(
      within(page).queryByRole("region", { name: "Natural version" })
    ).toBeNull();
  });

  it("notes each Naturalness Note as unnatural, after the Findings' notes", async () => {
    const { page } = await renderWrite({
      ...evaluated,
      occurrences: [
        ...evaluated.occurrences,
        {
          category: "UNNATURAL_PHRASING",
          correctedSpan: "I got home",
          example: "I got home late.",
          explanation: "'Got home' is what a fluent speaker would say.",
          findingPosition: null,
          id: "note-1",
          l1Transfer: false,
          originalSpan: "I goed home",
          severity: "UNNATURAL",
        },
      ],
    });
    await userEvent.click(
      within(page).getByRole("button", { name: "Get feedback" })
    );

    const notes = await within(page).findByRole("region", { name: "Notes" });
    expect(notes).toHaveTextContent(
      "Save to vocabulary2UnnaturalUnnatural phrasingI goed home → corrected toI got home'Got home' is what a fluent speaker would say.“I got home late.”Save to vocabulary"
    );
  });

  it("starts over on the same page with an empty sheet", async () => {
    const { page } = await renderWrite(evaluated);
    await userEvent.click(
      within(page).getByRole("button", { name: "Get feedback" })
    );
    await userEvent.click(
      await within(page).findByRole("button", { name: "Write something else" })
    );

    expect(
      within(page).getByRole("textbox", { name: "Your text" })
    ).toHaveValue("");
  });

  it("saves an Occurrence to vocabulary through the history state", async () => {
    const { page } = await renderWrite(evaluated);
    await userEvent.click(
      within(page).getByRole("button", { name: "Get feedback" })
    );
    await userEvent.click(
      await within(page).findByRole("link", { name: "Save to vocabulary" })
    );

    const vocabulary = await screen.findByRole("heading", {
      level: 1,
      name: "Vocabulary",
    });
    expect(vocabulary).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Term" })).toHaveValue("went");
    expect(
      screen.getByRole("textbox", { name: "Example sentence" })
    ).toHaveValue("I went home early.");
  });

  it("keeps the text and shows the route's message when the Enrichment fails", async () => {
    const { page } = await renderWrite({
      evaluationId: "practice-1",
      message:
        "We couldn't analyze this writing right now. Your text has not been lost — you can try again.",
      status: "failed",
    });
    await userEvent.click(
      within(page).getByRole("button", { name: "Get feedback" })
    );

    expect(await within(page).findByRole("alert")).toHaveTextContent(
      "We couldn't analyze this writing right now. Your text has not been lost — you can try again."
    );
    expect(
      within(page).getByRole("textbox", { name: "Your text" })
    ).toHaveValue("I goed home.");
  });

  it("points to setup when the Trainer has no key", async () => {
    const { page } = await renderWrite(
      new AcademyRequestError(401, {
        code: "AI_KEY_REQUIRED",
        error: "Set up your AI key to get feedback.",
      })
    );
    await userEvent.click(
      within(page).getByRole("button", { name: "Get feedback" })
    );

    expect(
      await within(page).findByRole("link", { name: "Set up a key" })
    ).toHaveAttribute("href", "/setup");
  });

  // The hosted Judge runs on the visitor's OpenRouter key (docs/adr/0035).
  it("points to the key page when the hosted Judge has no OpenRouter key", async () => {
    const { page } = await renderWrite(
      new AcademyRequestError(401, {
        code: "AI_JUDGE_KEY_REQUIRED",
        error: "Set up an OpenRouter key to get feedback on your writing.",
      }),
      "hosted"
    );
    await userEvent.click(
      within(page).getByRole("button", { name: "Get feedback" })
    );

    expect(
      await within(page).findByRole("link", { name: "Set up a key" })
    ).toHaveAttribute("href", "/settings");
  });

  it("keeps the text and shows Grifando's generic message for any other failure", async () => {
    const { page } = await renderWrite(new AcademyRequestError(503));
    await userEvent.click(
      within(page).getByRole("button", { name: "Get feedback" })
    );

    expect(await within(page).findByRole("alert")).toHaveTextContent(
      "We couldn't analyze this writing right now. Your text has not been lost."
    );
    expect(
      within(page).getByRole("textbox", { name: "Your text" })
    ).toHaveValue("I goed home.");
  });
});

// The sheet a /write page offers under a Deploy Profile with these caps.
const sheetUnder = async (limits: SampleLimits) => {
  render(
    <RouterProvider
      router={createAppRouter({
        academyClient: createInMemoryAcademyClient({ sampleLimits: limits }),
        evaluationClient: createInMemoryEvaluationClient(),
        history: createMemoryHistory({ initialEntries: ["/write"] }),
      })}
    />
  );
  const page = await screen.findByRole("main");
  return {
    page,
    sheet: within(page).getByRole("textbox", { name: "Your text" }),
  };
};

// Grifando's sheet stopped at its public site's 5000 characters; under docs/adr/0006 the Deploy
// Profile's caps size it (#196).
describe("/write sheet caps", () => {
  it("stops the sheet at the Deploy Profile's character cap, and counts up to it", async () => {
    const { page, sheet } = await sheetUnder({
      sampleMaxBytes: 32_768,
      sampleMaxCharacters: 4000,
    });

    expect(sheet).toHaveAttribute("maxlength", "4000");
    expect(within(page).getByText("0 / 4000")).toBeVisible();
  });

  it("leaves the sheet without a character cap when the Deploy Profile has none", async () => {
    const { page, sheet } = await sheetUnder({
      sampleMaxBytes: 32_768,
      sampleMaxCharacters: null,
    });
    await userEvent.type(sheet, "I goed home.");

    expect(sheet).not.toHaveAttribute("maxlength");
    expect(within(page).getByText("12 characters")).toBeVisible();
  });
});
