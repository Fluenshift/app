// Typed stub for the red commit of #14: the tests compile and fail on their checks.
import { Schema } from "effect";

export const PROMPT_TYPES = [] as unknown as readonly (
  | "FREE"
  | "DAILY_CHALLENGE"
  | "TECHNICAL"
  | "EXPLAIN_CODE"
  | "INTERVIEW"
)[];
export const PromptType = {} as {
  readonly [
    Member in
      | "FREE"
      | "DAILY_CHALLENGE"
      | "TECHNICAL"
      | "EXPLAIN_CODE"
      | "INTERVIEW"
  ]: Member;
};
export type PromptType =
  | "FREE"
  | "DAILY_CHALLENGE"
  | "TECHNICAL"
  | "EXPLAIN_CODE"
  | "INTERVIEW";
export const PromptTypeSchema = Schema.String as unknown as Schema.Literals<
  readonly (
    | "FREE"
    | "DAILY_CHALLENGE"
    | "TECHNICAL"
    | "EXPLAIN_CODE"
    | "INTERVIEW"
  )[]
>;

export const TECHNICAL_CATEGORIES = [] as unknown as readonly (
  | "BACKEND"
  | "FRONTEND"
  | "DEVOPS"
  | "DATABASES"
  | "CLOUD"
  | "ARCHITECTURE"
  | "ALGORITHMS"
  | "TESTING"
  | "GIT"
  | "GITHUB"
  | "CODE_REVIEW"
  | "SECURITY"
  | "AI"
  | "SYSTEM_DESIGN"
)[];
export const TechnicalCategory = {} as {
  readonly [
    Member in
      | "BACKEND"
      | "FRONTEND"
      | "DEVOPS"
      | "DATABASES"
      | "CLOUD"
      | "ARCHITECTURE"
      | "ALGORITHMS"
      | "TESTING"
      | "GIT"
      | "GITHUB"
      | "CODE_REVIEW"
      | "SECURITY"
      | "AI"
      | "SYSTEM_DESIGN"
  ]: Member;
};
export type TechnicalCategory =
  | "BACKEND"
  | "FRONTEND"
  | "DEVOPS"
  | "DATABASES"
  | "CLOUD"
  | "ARCHITECTURE"
  | "ALGORITHMS"
  | "TESTING"
  | "GIT"
  | "GITHUB"
  | "CODE_REVIEW"
  | "SECURITY"
  | "AI"
  | "SYSTEM_DESIGN";
export const TechnicalCategorySchema =
  Schema.String as unknown as Schema.Literals<
    readonly (
      | "BACKEND"
      | "FRONTEND"
      | "DEVOPS"
      | "DATABASES"
      | "CLOUD"
      | "ARCHITECTURE"
      | "ALGORITHMS"
      | "TESTING"
      | "GIT"
      | "GITHUB"
      | "CODE_REVIEW"
      | "SECURITY"
      | "AI"
      | "SYSTEM_DESIGN"
    )[]
  >;

export const SESSION_STATUSES = [] as unknown as readonly (
  | "PENDING"
  | "ANALYZED"
  | "FAILED"
)[];
export const SessionStatus = {} as {
  readonly [Member in "PENDING" | "ANALYZED" | "FAILED"]: Member;
};
export type SessionStatus = "PENDING" | "ANALYZED" | "FAILED";
export const SessionStatusSchema = Schema.String as unknown as Schema.Literals<
  readonly ("PENDING" | "ANALYZED" | "FAILED")[]
>;

export const MISTAKE_CATEGORIES = [] as unknown as readonly (
  | "ARTICLES"
  | "PREPOSITIONS"
  | "VERB_TENSE"
  | "SUBJECT_VERB_AGREEMENT"
  | "VOCABULARY"
  | "WORD_ORDER"
  | "SPELLING"
  | "PUNCTUATION"
  | "UNNATURAL_PHRASING"
  | "LITERAL_TRANSLATION"
  | "COLLOCATION"
  | "PRONOUNS"
  | "COUNTABLE_UNCOUNTABLE"
)[];
export const MistakeCategory = {} as {
  readonly [
    Member in
      | "ARTICLES"
      | "PREPOSITIONS"
      | "VERB_TENSE"
      | "SUBJECT_VERB_AGREEMENT"
      | "VOCABULARY"
      | "WORD_ORDER"
      | "SPELLING"
      | "PUNCTUATION"
      | "UNNATURAL_PHRASING"
      | "LITERAL_TRANSLATION"
      | "COLLOCATION"
      | "PRONOUNS"
      | "COUNTABLE_UNCOUNTABLE"
  ]: Member;
};
export type MistakeCategory =
  | "ARTICLES"
  | "PREPOSITIONS"
  | "VERB_TENSE"
  | "SUBJECT_VERB_AGREEMENT"
  | "VOCABULARY"
  | "WORD_ORDER"
  | "SPELLING"
  | "PUNCTUATION"
  | "UNNATURAL_PHRASING"
  | "LITERAL_TRANSLATION"
  | "COLLOCATION"
  | "PRONOUNS"
  | "COUNTABLE_UNCOUNTABLE";
export const MistakeCategorySchema =
  Schema.String as unknown as Schema.Literals<
    readonly (
      | "ARTICLES"
      | "PREPOSITIONS"
      | "VERB_TENSE"
      | "SUBJECT_VERB_AGREEMENT"
      | "VOCABULARY"
      | "WORD_ORDER"
      | "SPELLING"
      | "PUNCTUATION"
      | "UNNATURAL_PHRASING"
      | "LITERAL_TRANSLATION"
      | "COLLOCATION"
      | "PRONOUNS"
      | "COUNTABLE_UNCOUNTABLE"
    )[]
  >;

export const MISTAKE_SEVERITIES = [] as unknown as readonly (
  | "ERROR"
  | "UNNATURAL"
)[];
export const MistakeSeverity = {} as {
  readonly [Member in "ERROR" | "UNNATURAL"]: Member;
};
export type MistakeSeverity = "ERROR" | "UNNATURAL";
export const MistakeSeveritySchema =
  Schema.String as unknown as Schema.Literals<
    readonly ("ERROR" | "UNNATURAL")[]
  >;

export const MASTERY_LEVELS = [] as unknown as readonly (
  | "ACTIVE"
  | "IMPROVING"
  | "MASTERED"
)[];
export const MasteryLevel = {} as {
  readonly [Member in "ACTIVE" | "IMPROVING" | "MASTERED"]: Member;
};
export type MasteryLevel = "ACTIVE" | "IMPROVING" | "MASTERED";
export const MasteryLevelSchema = Schema.String as unknown as Schema.Literals<
  readonly ("ACTIVE" | "IMPROVING" | "MASTERED")[]
>;

export const EXERCISE_TYPES = [] as unknown as readonly (
  | "MULTIPLE_CHOICE"
  | "FILL_BLANK"
  | "REWRITE"
  | "TRANSLATION"
)[];
export const ExerciseType = {} as {
  readonly [
    Member in "MULTIPLE_CHOICE" | "FILL_BLANK" | "REWRITE" | "TRANSLATION"
  ]: Member;
};
export type ExerciseType =
  | "MULTIPLE_CHOICE"
  | "FILL_BLANK"
  | "REWRITE"
  | "TRANSLATION";
export const ExerciseTypeSchema = Schema.String as unknown as Schema.Literals<
  readonly ("MULTIPLE_CHOICE" | "FILL_BLANK" | "REWRITE" | "TRANSLATION")[]
>;

export const INTERVIEW_STATUSES = [] as unknown as readonly (
  | "ACTIVE"
  | "ENDED"
)[];
export const InterviewStatus = {} as {
  readonly [Member in "ACTIVE" | "ENDED"]: Member;
};
export type InterviewStatus = "ACTIVE" | "ENDED";
export const InterviewStatusSchema =
  Schema.String as unknown as Schema.Literals<readonly ("ACTIVE" | "ENDED")[]>;
