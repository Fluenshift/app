import { MistakeCategory } from "@fluenshift/contract";
import { describe, expect, it } from "vitest";

import {
  DAILY_PROMPTS,
  extractActiveWeakCategories,
  selectDailyPrompt,
} from "./daily-prompt";

const promptA = {
  id: "a",
  text: "A",
  focusCategories: [MistakeCategory.ARTICLES],
};
const promptB = {
  id: "b",
  text: "B",
  focusCategories: [MistakeCategory.VERB_TENSE],
};
const promptC = { id: "c", text: "C", focusCategories: [] };

describe("selectDailyPrompt", () => {
  it("returns the same prompt for the same calendar day", () => {
    const date = new Date("2026-03-05T08:00:00Z");
    const first = selectDailyPrompt(DAILY_PROMPTS, date);
    const second = selectDailyPrompt(
      DAILY_PROMPTS,
      new Date("2026-03-05T20:00:00Z")
    );
    expect(first.id).toBe(second.id);
  });

  it("can return a different prompt on a different day", () => {
    const results = new Set(
      Array.from(
        { length: 30 },
        (_, day) =>
          selectDailyPrompt(DAILY_PROMPTS, new Date(2026, 0, day + 1)).id
      )
    );
    expect(results.size).toBeGreaterThan(1);
  });

  it("only picks from prompts tagged with a weak category, when any match", () => {
    const date = new Date("2026-03-05T00:00:00Z");
    const result = selectDailyPrompt([promptA, promptB, promptC], date, [
      MistakeCategory.ARTICLES,
    ]);
    expect(result.id).toBe("a");
  });

  it("falls back to the full bank when no prompt matches the weak categories", () => {
    const date = new Date("2026-03-05T00:00:00Z");
    const result = selectDailyPrompt([promptA, promptB], date, [
      MistakeCategory.SPELLING,
    ]);
    expect(["a", "b"]).toContain(result.id);
  });

  it("uses the full bank when no weak categories are given", () => {
    const date = new Date("2026-03-05T00:00:00Z");
    const result = selectDailyPrompt([promptA, promptB, promptC], date);
    expect(["a", "b", "c"]).toContain(result.id);
  });
});

describe("extractActiveWeakCategories", () => {
  it("includes ACTIVE and IMPROVING categories", () => {
    const result = extractActiveWeakCategories([
      { category: MistakeCategory.ARTICLES, masteryLevel: "ACTIVE" },
      { category: MistakeCategory.VERB_TENSE, masteryLevel: "IMPROVING" },
    ]);
    expect(result).toContain(MistakeCategory.ARTICLES);
    expect(result).toContain(MistakeCategory.VERB_TENSE);
  });

  it("excludes MASTERED categories", () => {
    const result = extractActiveWeakCategories([
      { category: MistakeCategory.ARTICLES, masteryLevel: "MASTERED" },
    ]);
    expect(result).toEqual([]);
  });

  it("deduplicates repeated categories", () => {
    const result = extractActiveWeakCategories([
      { category: MistakeCategory.ARTICLES, masteryLevel: "ACTIVE" },
      { category: MistakeCategory.ARTICLES, masteryLevel: "IMPROVING" },
    ]);
    expect(result).toEqual([MistakeCategory.ARTICLES]);
  });
});

describe("daily prompt guards", () => {
  it("picks the same prompt as the baseline on fixed days", () => {
    const picks = ["2026-01-01", "2026-03-05", "2026-11-14", "2026-12-31"].map(
      (key) => selectDailyPrompt(DAILY_PROMPTS, new Date(`${key}T12:00:00Z`)).id
    );

    expect(picks).toEqual([
      "explain-docker",
      "explain-api",
      "why-testing-matters",
      "memory-leak",
    ]);
    expect(
      selectDailyPrompt(DAILY_PROMPTS, new Date("2026-03-05T12:00:00Z"), [
        MistakeCategory.PREPOSITIONS,
      ]).id
    ).toBe("bug-you-solved");
    expect(
      selectDailyPrompt(DAILY_PROMPTS, new Date("2026-11-14T12:00:00Z"), [
        MistakeCategory.PRONOUNS,
        MistakeCategory.COLLOCATION,
      ]).id
    ).toBe("interview-disagreement");
  });

  it("keeps the prompt bank as written", () => {
    expect(DAILY_PROMPTS).toEqual([
      {
        id: "explain-docker",
        text: "Explain what Docker is, as if to a junior developer joining your team.",
        focusCategories: [
          MistakeCategory.VOCABULARY,
          MistakeCategory.UNNATURAL_PHRASING,
        ],
      },
      {
        id: "describe-todays-work",
        text: "Describe what you worked on today, or, if you didn't code today, what you worked on most recently.",
        focusCategories: [MistakeCategory.VERB_TENSE],
      },
      {
        id: "repository-pattern",
        text: "Explain the Repository Pattern and why (or why not) you'd use it in a project.",
        focusCategories: [
          MistakeCategory.SUBJECT_VERB_AGREEMENT,
          MistakeCategory.VOCABULARY,
        ],
      },
      {
        id: "github-issue",
        text: "Write a short GitHub issue describing a bug you've run into recently.",
        focusCategories: [MistakeCategory.ARTICLES, MistakeCategory.VERB_TENSE],
      },
      {
        id: "process-vs-thread",
        text: "Explain the difference between a process and a thread.",
        focusCategories: [
          MistakeCategory.WORD_ORDER,
          MistakeCategory.VOCABULARY,
        ],
      },
      {
        id: "bug-you-solved",
        text: "Describe a bug you recently solved and how you found the root cause.",
        focusCategories: [
          MistakeCategory.VERB_TENSE,
          MistakeCategory.PREPOSITIONS,
        ],
      },
      {
        id: "explain-api",
        text: "Explain what an API is to someone with no programming background.",
        focusCategories: [
          MistakeCategory.UNNATURAL_PHRASING,
          MistakeCategory.ARTICLES,
        ],
      },
      {
        id: "interview-disagreement",
        text: 'Write an answer to this interview question: "Tell me about a time you disagreed with a teammate."',
        focusCategories: [MistakeCategory.VERB_TENSE, MistakeCategory.PRONOUNS],
      },
      {
        id: "authn-vs-authz",
        text: "Explain the difference between authentication and authorization.",
        focusCategories: [
          MistakeCategory.WORD_ORDER,
          MistakeCategory.COLLOCATION,
        ],
      },
      {
        id: "pr-description",
        text: "Write a short pull request description for a change you imagine making to a to-do list app.",
        focusCategories: [
          MistakeCategory.ARTICLES,
          MistakeCategory.PREPOSITIONS,
        ],
      },
      {
        id: "technical-debt",
        text: 'Describe how you would explain "technical debt" to a non-technical manager.',
        focusCategories: [
          MistakeCategory.VOCABULARY,
          MistakeCategory.UNNATURAL_PHRASING,
        ],
      },
      {
        id: "why-testing-matters",
        text: "Explain why testing matters, using an example from a project you've worked on.",
        focusCategories: [
          MistakeCategory.VERB_TENSE,
          MistakeCategory.SUBJECT_VERB_AGREEMENT,
        ],
      },
      {
        id: "ideal-dev-environment",
        text: "Describe your ideal development environment and why you prefer it.",
        focusCategories: [
          MistakeCategory.PRONOUNS,
          MistakeCategory.COLLOCATION,
        ],
      },
      {
        id: "race-condition",
        text: "Explain what a race condition is and give a simple example.",
        focusCategories: [
          MistakeCategory.ARTICLES,
          MistakeCategory.COUNTABLE_UNCOUNTABLE,
        ],
      },
      {
        id: "readme-intro",
        text: "Write a short README introduction for a personal project.",
        focusCategories: [
          MistakeCategory.PREPOSITIONS,
          MistakeCategory.ARTICLES,
        ],
      },
      {
        id: "sql-vs-nosql",
        text: "Explain the tradeoffs between SQL and NoSQL databases for a new project.",
        focusCategories: [
          MistakeCategory.COLLOCATION,
          MistakeCategory.WORD_ORDER,
        ],
      },
      {
        id: "learned-quickly",
        text: "Describe a time you had to learn a new technology quickly.",
        focusCategories: [MistakeCategory.VERB_TENSE, MistakeCategory.PRONOUNS],
      },
      {
        id: "memory-leak",
        text: "Explain what a memory leak is and why it's a problem.",
        focusCategories: [MistakeCategory.ARTICLES, MistakeCategory.VOCABULARY],
      },
    ]);
  });
});
