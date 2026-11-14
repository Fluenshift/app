import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  EXERCISE_TYPES,
  ExerciseType,
  ExerciseTypeSchema,
  INTERVIEW_STATUSES,
  InterviewStatus,
  InterviewStatusSchema,
  MASTERY_LEVELS,
  MasteryLevel,
  MasteryLevelSchema,
  MISTAKE_CATEGORIES,
  MISTAKE_SEVERITIES,
  MistakeCategory,
  MistakeCategorySchema,
  MistakeSeverity,
  MistakeSeveritySchema,
  PROMPT_TYPES,
  PromptType,
  PromptTypeSchema,
  SESSION_STATUSES,
  SessionStatus,
  SessionStatusSchema,
  TECHNICAL_CATEGORIES,
  TechnicalCategory,
  TechnicalCategorySchema,
} from "./academy";

// The enums of Grifando's prisma/schema.prisma at the pinned commit (74dbb9f), in their
// declared order. Ported Academy modules read them as `MasteryLevel.MASTERED`, iterate them
// with `Object.values`, and decode them with the schemas.
const PRISMA_ENUMS = {
  PromptType: [
    "FREE",
    "DAILY_CHALLENGE",
    "TECHNICAL",
    "EXPLAIN_CODE",
    "INTERVIEW",
  ],
  TechnicalCategory: [
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
  ],
  SessionStatus: ["PENDING", "ANALYZED", "FAILED"],
  MistakeCategory: [
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
  ],
  MistakeSeverity: ["ERROR", "UNNATURAL"],
  MasteryLevel: ["ACTIVE", "IMPROVING", "MASTERED"],
  ExerciseType: ["MULTIPLE_CHOICE", "FILL_BLANK", "REWRITE", "TRANSLATION"],
  InterviewStatus: ["ACTIVE", "ENDED"],
} as const;

const ENUMS = {
  PromptType: [PROMPT_TYPES, PromptType, PromptTypeSchema],
  TechnicalCategory: [
    TECHNICAL_CATEGORIES,
    TechnicalCategory,
    TechnicalCategorySchema,
  ],
  SessionStatus: [SESSION_STATUSES, SessionStatus, SessionStatusSchema],
  MistakeCategory: [MISTAKE_CATEGORIES, MistakeCategory, MistakeCategorySchema],
  MistakeSeverity: [MISTAKE_SEVERITIES, MistakeSeverity, MistakeSeveritySchema],
  MasteryLevel: [MASTERY_LEVELS, MasteryLevel, MasteryLevelSchema],
  ExerciseType: [EXERCISE_TYPES, ExerciseType, ExerciseTypeSchema],
  InterviewStatus: [INTERVIEW_STATUSES, InterviewStatus, InterviewStatusSchema],
} as const;

describe("Academy literals", () => {
  it("lists every Prisma enum member in its declared order", () => {
    for (const [name, [values, object]] of Object.entries(ENUMS)) {
      const expected = PRISMA_ENUMS[name as keyof typeof PRISMA_ENUMS];

      expect(values).toStrictEqual(expected);
      expect(Object.values(object)).toStrictEqual(expected);
      expect(Object.keys(object)).toStrictEqual(expected);
    }
  });

  it("decodes members and rejects anything else", () => {
    for (const [name, [values, , schema]] of Object.entries(ENUMS)) {
      for (const value of values) {
        expect(Schema.decodeSync(schema)(value)).toBe(value);
      }

      expect(() => Schema.decodeUnknownSync(schema)(`NOT_${name}`)).toThrow(
        "Expected"
      );
      expect(() =>
        Schema.decodeUnknownSync(schema)(values[0]?.toLowerCase())
      ).toThrow("Expected");
    }
  });
});
