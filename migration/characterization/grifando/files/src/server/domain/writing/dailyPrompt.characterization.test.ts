// Characterization of src/server/domain/writing/dailyPrompt.ts at the Grifando baseline: the
// baseline tests check that a day's pick is stable and varies, not which prompt a day gets,
// so none pins the day hash; and none reads the bank's copy.
import { describe, expect, it } from "vitest";

import { MistakeCategory } from "@/generated/prisma/enums";
import { DAILY_PROMPTS, selectDailyPrompt } from "@/server/domain/writing/dailyPrompt";

describe("daily prompt guards", () => {
  it("picks the same prompt as the baseline on fixed days", () => {
    const picks = ["2026-01-01", "2026-03-05", "2026-11-14", "2026-12-31"].map(
      (key) => selectDailyPrompt(DAILY_PROMPTS, new Date(`${key}T12:00:00Z`)).id,
    );

    expect(picks).toEqual(["explain-docker", "explain-api", "why-testing-matters", "memory-leak"]);
    expect(
      selectDailyPrompt(DAILY_PROMPTS, new Date("2026-03-05T12:00:00Z"), [MistakeCategory.PREPOSITIONS]).id,
    ).toBe("bug-you-solved");
    expect(
      selectDailyPrompt(DAILY_PROMPTS, new Date("2026-11-14T12:00:00Z"), [
        MistakeCategory.PRONOUNS,
        MistakeCategory.COLLOCATION,
      ]).id,
    ).toBe("interview-disagreement");
  });

  it("keeps the prompt bank as written", () => {
    expect(DAILY_PROMPTS).toEqual([
  {
    id: "explain-docker",
    text: "Explain what Docker is, as if to a junior developer joining your team.",
    focusCategories: [MistakeCategory.VOCABULARY, MistakeCategory.UNNATURAL_PHRASING],
  },
  {
    id: "describe-todays-work",
    text: "Describe what you worked on today, or, if you didn't code today, what you worked on most recently.",
    focusCategories: [MistakeCategory.VERB_TENSE],
  },
  {
    id: "repository-pattern",
    text: "Explain the Repository Pattern and why (or why not) you'd use it in a project.",
    focusCategories: [MistakeCategory.SUBJECT_VERB_AGREEMENT, MistakeCategory.VOCABULARY],
  },
  {
    id: "github-issue",
    text: "Write a short GitHub issue describing a bug you've run into recently.",
    focusCategories: [MistakeCategory.ARTICLES, MistakeCategory.VERB_TENSE],
  },
  {
    id: "process-vs-thread",
    text: "Explain the difference between a process and a thread.",
    focusCategories: [MistakeCategory.WORD_ORDER, MistakeCategory.VOCABULARY],
  },
  {
    id: "bug-you-solved",
    text: "Describe a bug you recently solved and how you found the root cause.",
    focusCategories: [MistakeCategory.VERB_TENSE, MistakeCategory.PREPOSITIONS],
  },
  {
    id: "explain-api",
    text: "Explain what an API is to someone with no programming background.",
    focusCategories: [MistakeCategory.UNNATURAL_PHRASING, MistakeCategory.ARTICLES],
  },
  {
    id: "interview-disagreement",
    text: "Write an answer to this interview question: \"Tell me about a time you disagreed with a teammate.\"",
    focusCategories: [MistakeCategory.VERB_TENSE, MistakeCategory.PRONOUNS],
  },
  {
    id: "authn-vs-authz",
    text: "Explain the difference between authentication and authorization.",
    focusCategories: [MistakeCategory.WORD_ORDER, MistakeCategory.COLLOCATION],
  },
  {
    id: "pr-description",
    text: "Write a short pull request description for a change you imagine making to a to-do list app.",
    focusCategories: [MistakeCategory.ARTICLES, MistakeCategory.PREPOSITIONS],
  },
  {
    id: "technical-debt",
    text: "Describe how you would explain \"technical debt\" to a non-technical manager.",
    focusCategories: [MistakeCategory.VOCABULARY, MistakeCategory.UNNATURAL_PHRASING],
  },
  {
    id: "why-testing-matters",
    text: "Explain why testing matters, using an example from a project you've worked on.",
    focusCategories: [MistakeCategory.VERB_TENSE, MistakeCategory.SUBJECT_VERB_AGREEMENT],
  },
  {
    id: "ideal-dev-environment",
    text: "Describe your ideal development environment and why you prefer it.",
    focusCategories: [MistakeCategory.PRONOUNS, MistakeCategory.COLLOCATION],
  },
  {
    id: "race-condition",
    text: "Explain what a race condition is and give a simple example.",
    focusCategories: [MistakeCategory.ARTICLES, MistakeCategory.COUNTABLE_UNCOUNTABLE],
  },
  {
    id: "readme-intro",
    text: "Write a short README introduction for a personal project.",
    focusCategories: [MistakeCategory.PREPOSITIONS, MistakeCategory.ARTICLES],
  },
  {
    id: "sql-vs-nosql",
    text: "Explain the tradeoffs between SQL and NoSQL databases for a new project.",
    focusCategories: [MistakeCategory.COLLOCATION, MistakeCategory.WORD_ORDER],
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
