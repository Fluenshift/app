// How the Academy names each Mistake Category. Ported from Grifando
// src/lib/mistakeCategoryLabels.ts (74dbb9f).
import type { MistakeCategory } from "@fluenshift/contract";

export const MISTAKE_CATEGORY_LABELS: Readonly<
  Record<MistakeCategory, string>
> = {
  ARTICLES: "Articles",
  COLLOCATION: "Collocation",
  COUNTABLE_UNCOUNTABLE: "Countable/uncountable",
  LITERAL_TRANSLATION: "Literal translation",
  PREPOSITIONS: "Prepositions",
  PRONOUNS: "Pronouns",
  PUNCTUATION: "Punctuation",
  SPELLING: "Spelling",
  SUBJECT_VERB_AGREEMENT: "Subject-verb agreement",
  UNNATURAL_PHRASING: "Unnatural phrasing",
  VERB_TENSE: "Verb tense",
  VOCABULARY: "Vocabulary",
  WORD_ORDER: "Word order",
};
