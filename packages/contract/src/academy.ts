// The Academy's closed value sets, ported from the enums of Grifando's prisma/schema.prisma.
// Each set has three forms: the ordered members, an object whose keys equal its values (so
// ported modules keep `MasteryLevel.MASTERED` and `Object.values(TechnicalCategory)`), and an
// Effect Schema for decoding. How MistakeCategory maps onto PE's Error Categories is decided
// separately (docs/adr/0005).
import { Schema } from "effect";

import type { ErrorCategory } from "./evaluation";

type LiteralObject<Values extends readonly string[]> = {
  readonly [Value in Values[number]]: Value;
};

const literalObject = <const Values extends readonly string[]>(
  values: Values
): LiteralObject<Values> =>
  Object.fromEntries(
    values.map((value) => [value, value])
  ) as LiteralObject<Values>;

export const PROMPT_TYPES = [
  "FREE",
  "DAILY_CHALLENGE",
  "TECHNICAL",
  "EXPLAIN_CODE",
  "INTERVIEW",
] as const;
export const PromptType = literalObject(PROMPT_TYPES);
export type PromptType = (typeof PROMPT_TYPES)[number];
export const PromptTypeSchema = Schema.Literals(PROMPT_TYPES);

export const TECHNICAL_CATEGORIES = [
  "BACKEND",
  "FRONTEND",
  "DEVOPS",
  "DATABASES",
  "CLOUD",
  "ARCHITECTURE",
  "ALGORITHMS",
  "TESTING",
  "GIT",
  "GITHUB",
  "CODE_REVIEW",
  "SECURITY",
  "AI",
  "SYSTEM_DESIGN",
] as const;
export const TechnicalCategory = literalObject(TECHNICAL_CATEGORIES);
export type TechnicalCategory = (typeof TECHNICAL_CATEGORIES)[number];
export const TechnicalCategorySchema = Schema.Literals(TECHNICAL_CATEGORIES);

export const SESSION_STATUSES = ["PENDING", "ANALYZED", "FAILED"] as const;
export const SessionStatus = literalObject(SESSION_STATUSES);
export type SessionStatus = (typeof SESSION_STATUSES)[number];
export const SessionStatusSchema = Schema.Literals(SESSION_STATUSES);

export const MISTAKE_CATEGORIES = [
  "ARTICLES",
  "PREPOSITIONS",
  "VERB_TENSE",
  "SUBJECT_VERB_AGREEMENT",
  "VOCABULARY",
  "WORD_ORDER",
  "SPELLING",
  "PUNCTUATION",
  "UNNATURAL_PHRASING",
  "LITERAL_TRANSLATION",
  "COLLOCATION",
  "PRONOUNS",
  "COUNTABLE_UNCOUNTABLE",
] as const;
export const MistakeCategory = literalObject(MISTAKE_CATEGORIES);
export type MistakeCategory = (typeof MISTAKE_CATEGORIES)[number];
export const MistakeCategorySchema = Schema.Literals(MISTAKE_CATEGORIES);

export const MISTAKE_SEVERITIES = ["ERROR", "UNNATURAL"] as const;
export const MistakeSeverity = literalObject(MISTAKE_SEVERITIES);
export type MistakeSeverity = (typeof MISTAKE_SEVERITIES)[number];
export const MistakeSeveritySchema = Schema.Literals(MISTAKE_SEVERITIES);

export const MASTERY_LEVELS = ["ACTIVE", "IMPROVING", "MASTERED"] as const;
export const MasteryLevel = literalObject(MASTERY_LEVELS);
export type MasteryLevel = (typeof MASTERY_LEVELS)[number];
export const MasteryLevelSchema = Schema.Literals(MASTERY_LEVELS);

export const EXERCISE_TYPES = [
  "MULTIPLE_CHOICE",
  "FILL_BLANK",
  "REWRITE",
  "TRANSLATION",
] as const;
export const ExerciseType = literalObject(EXERCISE_TYPES);
export type ExerciseType = (typeof EXERCISE_TYPES)[number];
export const ExerciseTypeSchema = Schema.Literals(EXERCISE_TYPES);

export const INTERVIEW_STATUSES = ["ACTIVE", "ENDED"] as const;
export const InterviewStatus = literalObject(INTERVIEW_STATUSES);
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];
export const InterviewStatusSchema = Schema.Literals(INTERVIEW_STATUSES);

// The Error Category a Mistake Category rolls up to (docs/adr/0005). UNNATURAL_PHRASING is the
// "correct but unnatural" channel, not an error, and LITERAL_TRANSLATION becomes the L1 Transfer
// flag on the category of the underlying error, so neither rolls up to one.
const ROLL_UP: Readonly<Partial<Record<MistakeCategory, ErrorCategory>>> = {
  ARTICLES: "Article",
  COLLOCATION: "Word choice",
  COUNTABLE_UNCOUNTABLE: "Grammar/syntax",
  PREPOSITIONS: "Preposition",
  PRONOUNS: "Grammar/syntax",
  PUNCTUATION: "Punctuation/capitalization",
  SPELLING: "Spelling",
  SUBJECT_VERB_AGREEMENT: "Verb form/tense",
  VERB_TENSE: "Verb form/tense",
  VOCABULARY: "Word choice",
  WORD_ORDER: "Grammar/syntax",
};

export const errorCategoryOf = (
  category: MistakeCategory
): ErrorCategory | undefined => ROLL_UP[category];

// The Mistake Categories a Finding of one Error Category may take. Clarity and Other have none.
export const mistakeCategoriesOf = (
  category: ErrorCategory
): readonly MistakeCategory[] =>
  MISTAKE_CATEGORIES.filter(
    (mistakeCategory) => ROLL_UP[mistakeCategory] === category
  );

/**
 * A vocabulary item the Learner saves, with Grifando's limits (src/app/api/vocabulary/route.ts,
 * 74dbb9f). Its source is one of the Learner's Evaluations, which replace Grifando's writing
 * sessions (docs/adr/0004).
 */
export const VocabularyItemRequest = Schema.Struct({
  exampleSentence: Schema.Trim.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(500)
  ),
  meaningPt: Schema.Trim.check(Schema.isMinLength(1), Schema.isMaxLength(300)),
  sourceEvaluationId: Schema.optional(
    Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(64))
  ),
  term: Schema.Trim.check(Schema.isMinLength(1), Schema.isMaxLength(120)),
});
export type VocabularyItemRequest = typeof VocabularyItemRequest.Type;

/**
 * A request for a practice set (Grifando's POST /api/exercises, 74dbb9f). With an Evaluation,
 * the daily session's set opens with the patterns of that Evaluation's Occurrences; Evaluations
 * replace Grifando's writing sessions (docs/adr/0004).
 */
export const ExerciseGenerationRequest = Schema.Struct({
  afterEvaluationId: Schema.optional(
    Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(64))
  ),
});
export type ExerciseGenerationRequest = typeof ExerciseGenerationRequest.Type;
