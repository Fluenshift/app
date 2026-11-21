import { Exit, Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  errorCategoryOf,
  EXERCISE_TYPES,
  ExerciseType,
  ExerciseTypeSchema,
  INTERVIEW_STATUSES,
  InterviewAnswerRequest,
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
  mistakeCategoriesOf,
  PROMPT_TYPES,
  PromptType,
  PromptTypeSchema,
  SampleLimits,
  SESSION_STATUSES,
  SessionStatus,
  SessionStatusSchema,
  TECHNICAL_CATEGORIES,
  TechnicalCategory,
  TechnicalCategorySchema,
} from "./academy";
import { ERROR_CATEGORIES } from "./evaluation";

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

describe("Mistake Category roll-up", () => {
  it("rolls each Mistake Category up to its Error Category, as ADR 0005 maps them", () => {
    expect(
      Object.fromEntries(
        MISTAKE_CATEGORIES.map((category) => [
          category,
          errorCategoryOf(category) ?? null,
        ])
      )
    ).toStrictEqual({
      ARTICLES: "Article",
      PREPOSITIONS: "Preposition",
      VERB_TENSE: "Verb form/tense",
      SUBJECT_VERB_AGREEMENT: "Verb form/tense",
      VOCABULARY: "Word choice",
      WORD_ORDER: "Grammar/syntax",
      SPELLING: "Spelling",
      PUNCTUATION: "Punctuation/capitalization",
      UNNATURAL_PHRASING: null,
      LITERAL_TRANSLATION: null,
      COLLOCATION: "Word choice",
      PRONOUNS: "Grammar/syntax",
      COUNTABLE_UNCOUNTABLE: "Grammar/syntax",
    });
  });

  it("offers each Error Category its Mistake Categories, and none to Clarity and Other", () => {
    expect(
      Object.fromEntries(
        ERROR_CATEGORIES.map((category) => [
          category,
          mistakeCategoriesOf(category),
        ])
      )
    ).toStrictEqual({
      Spelling: ["SPELLING"],
      Article: ["ARTICLES"],
      "Verb form/tense": ["VERB_TENSE", "SUBJECT_VERB_AGREEMENT"],
      Preposition: ["PREPOSITIONS"],
      "Word choice": ["VOCABULARY", "COLLOCATION"],
      "Grammar/syntax": ["WORD_ORDER", "PRONOUNS", "COUNTABLE_UNCOUNTABLE"],
      "Punctuation/capitalization": ["PUNCTUATION"],
      Clarity: [],
      Other: [],
    });
  });
});

describe("SampleLimits", () => {
  it("decodes the Deploy Profile's caps, with or without a character cap", () => {
    const decode = Schema.decodeUnknownExit(SampleLimits);

    expect(
      [
        {
          codeMaxCharacters: null,
          sampleMaxBytes: 32_768,
          sampleMaxCharacters: null,
        },
        {
          codeMaxCharacters: 2000,
          sampleMaxBytes: 32_768,
          sampleMaxCharacters: 5000,
        },
        { sampleMaxBytes: 32_768 },
      ].map((limits) => decode(limits)._tag)
    ).toStrictEqual(["Success", "Success", "Failure"]);
  });
});

// Grifando capped an interview answer at 5000 characters, its public site's cap. Under
// docs/adr/0006 the Deploy Profile's caps bound every Writing Sample where the Judge evaluates it,
// so the request takes a trimmed answer of any length.
describe("InterviewAnswerRequest", () => {
  it("takes a trimmed answer longer than Grifando's 5000 characters", () => {
    const answer = "I shipped it. ".repeat(500);

    const decoded = Schema.decodeExit(InterviewAnswerRequest)({ answer });

    expect(Exit.isSuccess(decoded) && decoded.value).toStrictEqual({
      answer: answer.trim(),
    });
  });

  it("refuses an answer that is empty once trimmed", () => {
    expect(
      Schema.decodeExit(InterviewAnswerRequest)({ answer: "   " })._tag
    ).toBe("Failure");
  });
});
