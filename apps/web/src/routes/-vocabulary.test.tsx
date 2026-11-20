// Ported from Grifando's characterization of its /vocabulary page (74dbb9f,
// migration/characterization/grifando/files/src/app/pages.characterization.test.ts), under
// docs/adr/0025: the prefill of the form travels in the router's history state, never in the
// URL. The route test of apps/server checks the list and its Learner; this screen test checks what
// the page renders from the list, and Grifando's form and remove button, ported from their source.
import type { VocabularyItem } from "@fluenshift/contract";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import type { HistoryState } from "@tanstack/react-router";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { createInMemoryAcademyClient } from "../features/academy/in-memory-academy-client";
import { createInMemoryEvaluationClient } from "../features/evaluations/in-memory-evaluation-client";
import { createAppRouter } from "../router";

const older: VocabularyItem = {
  createdAt: "2026-03-03T12:00:00.000Z",
  exampleSentence: "I rely on tests.",
  id: "older",
  meaningPt: "depender de",
  sourceEvaluationId: null,
  term: "rely on",
};

const newer: VocabularyItem = {
  createdAt: "2026-03-04T12:00:00.000Z",
  exampleSentence: "We roll out on Fridays.",
  id: "newer",
  meaningPt: "implantar",
  sourceEvaluationId: null,
  term: "roll out",
};

const renderVocabulary = (
  options: Parameters<typeof createInMemoryAcademyClient>[0],
  state: HistoryState = {}
) => {
  const client = createInMemoryAcademyClient(options);
  const history = createMemoryHistory({ initialEntries: ["/"] });
  history.push("/vocabulary", state);
  const view = render(
    <RouterProvider
      router={createAppRouter({
        academyClient: client,
        evaluationClient: createInMemoryEvaluationClient(),
        history,
      })}
    />
  );
  return { client, view };
};

describe("/vocabulary", () => {
  it("lists the visitor's items newest first and prefills the form from the history state", async () => {
    const empty = renderVocabulary({ vocabulary: [] });
    const emptyPage = await screen.findByRole("main");
    expect(emptyPage).toHaveTextContent("0 entries");
    expect(emptyPage).toHaveTextContent("Nothing saved yet.");
    expect(
      within(emptyPage).getByRole("textbox", { name: "Term" })
    ).toHaveValue("");
    expect(
      within(emptyPage).getByRole("textbox", { name: "Example sentence" })
    ).toHaveValue("");
    empty.view.unmount();

    const { client } = renderVocabulary(
      { vocabulary: [newer, older] },
      {
        vocabularyPrefill: {
          example: "I take over.",
          sourceEvaluationId: "session-1",
          term: "take over",
        },
      }
    );
    const page = await screen.findByRole("main");
    expect(page).toHaveTextContent("2 entries");
    expect(page).toHaveTextContent(
      "roll outimplantar“We roll out on Fridays.”"
    );
    expect(
      within(page)
        .getAllByRole("button", { name: /^Remove /u })
        .map((button) => button.getAttribute("aria-label"))
    ).toEqual(["Remove roll out", "Remove rely on"]);
    expect(within(page).getByRole("textbox", { name: "Term" })).toHaveValue(
      "take over"
    );
    expect(
      within(page).getByRole("textbox", { name: "Example sentence" })
    ).toHaveValue("I take over.");

    // The form's source Evaluation travels with the save, as Grifando's sourceSessionId did.
    await userEvent.type(
      within(page).getByRole("textbox", { name: "Meaning in Portuguese" }),
      "assumir"
    );
    await userEvent.click(within(page).getByRole("button", { name: "Save" }));
    expect(client.vocabularyRequests).toEqual([
      {
        exampleSentence: "I take over.",
        meaningPt: "assumir",
        sourceEvaluationId: "session-1",
        term: "take over",
      },
    ]);
  });

  it("clears the form and lists the new word after a save", async () => {
    renderVocabulary({ vocabulary: [older] });
    const page = await screen.findByRole("main");
    const save = within(page).getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();

    await userEvent.type(
      within(page).getByRole("textbox", { name: "Term" }),
      "roll out"
    );
    await userEvent.type(
      within(page).getByRole("textbox", { name: "Meaning in Portuguese" }),
      "implantar"
    );
    await userEvent.type(
      within(page).getByRole("textbox", { name: "Example sentence" }),
      "We roll out on Fridays."
    );
    await userEvent.click(save);

    expect(await within(page).findByText("2 entries")).toBeInTheDocument();
    expect(within(page).getByRole("textbox", { name: "Term" })).toHaveValue("");
    expect(
      within(page).getByRole("textbox", { name: "Meaning in Portuguese" })
    ).toHaveValue("");
  });

  it("keeps the form and says the save failed when it fails", async () => {
    renderVocabulary({ failVocabularySaves: true, vocabulary: [] });
    const page = await screen.findByRole("main");
    await userEvent.type(
      within(page).getByRole("textbox", { name: "Term" }),
      "roll out"
    );
    await userEvent.type(
      within(page).getByRole("textbox", { name: "Meaning in Portuguese" }),
      "implantar"
    );
    await userEvent.type(
      within(page).getByRole("textbox", { name: "Example sentence" }),
      "We roll out on Fridays."
    );
    await userEvent.click(within(page).getByRole("button", { name: "Save" }));

    expect(await within(page).findByRole("alert")).toHaveTextContent(
      "Couldn't save this word. Please try again."
    );
    expect(within(page).getByRole("textbox", { name: "Term" })).toHaveValue(
      "roll out"
    );
  });

  it("removes an item and lists the rest", async () => {
    renderVocabulary({ vocabulary: [newer, older] });
    const page = await screen.findByRole("main");
    await userEvent.click(
      within(page).getByRole("button", { name: "Remove roll out" })
    );

    expect(await within(page).findByText("1 entry")).toBeInTheDocument();
    expect(page).not.toHaveTextContent("roll out");
    expect(page).toHaveTextContent("rely on");
  });
});
