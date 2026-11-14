// Ported from Grifando src/server/domain/writing/dailyPrompt.ts; SPEC.md is Grifando's. The
// prompt bank is copied verbatim.
import { MistakeCategory } from "@fluenshift/contract";

export interface DailyPrompt {
  id: string;
  text: string;
  // Grammar patterns this prompt's topic tends to elicit (e.g. a "describe
  // what happened" prompt naturally exercises VERB_TENSE) — used to bias
  // selection toward the user's weak areas (SPEC.md §5.5).
  focusCategories: MistakeCategory[];
}

export const DAILY_PROMPTS: DailyPrompt[] = [
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
    focusCategories: [MistakeCategory.WORD_ORDER, MistakeCategory.COLLOCATION],
  },
  {
    id: "pr-description",
    text: "Write a short pull request description for a change you imagine making to a to-do list app.",
    focusCategories: [MistakeCategory.ARTICLES, MistakeCategory.PREPOSITIONS],
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
    focusCategories: [MistakeCategory.PRONOUNS, MistakeCategory.COLLOCATION],
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
];

// Grifando shifts with `>>> 0` and reads `charCodeAt`, which lint rejects. For the
// non-negative integers below 2^53 this loop produces, the remainder of 2^32 is the same
// value, and an ISO date string is ASCII, where `codePointAt` equals `charCodeAt`.
const hashDay = (date: Date): number => {
  const dayString = date.toISOString().slice(0, 10);
  let hash = 0;
  for (const char of dayString) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 2 ** 32;
  }
  return hash;
};

// Deterministic per calendar day (UTC) so the prompt doesn't change on
// refresh, but does change day to day. Biases toward prompts tagged with any
// of the user's still-active mistake categories when at least one matches.
// As in Grifando, an empty bank yields undefined.
export const selectDailyPrompt = (
  prompts: DailyPrompt[],
  date: Date,
  weakCategories: MistakeCategory[] = []
): DailyPrompt => {
  const seed = hashDay(date);

  const biased =
    weakCategories.length > 0
      ? prompts.filter((prompt) =>
          prompt.focusCategories.some((category) =>
            weakCategories.includes(category)
          )
        )
      : [];

  const pool = biased.length > 0 ? biased : prompts;
  return pool[seed % pool.length] as DailyPrompt;
};

export const extractActiveWeakCategories = (
  patterns: { category: MistakeCategory; masteryLevel: string }[]
): MistakeCategory[] => {
  const categories = new Set<MistakeCategory>();
  for (const pattern of patterns) {
    if (pattern.masteryLevel !== "MASTERED") {
      categories.add(pattern.category);
    }
  }
  return [...categories];
};
