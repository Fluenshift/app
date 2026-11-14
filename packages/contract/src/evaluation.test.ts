import { Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  ERROR_CATEGORIES,
  Evaluation,
  EvaluationSubmissionResult,
  EvaluationSummary,
  FINDING_SEVERITIES,
  PROFICIENCY_BANDS,
  PROGRESS_PERIODS,
  ProgressEvidence,
  ProgressEvidenceRequest,
  ProgressSummary,
  SetupStatus,
  WRITING_SAMPLE_ORIGINS,
  WritingSampleOrigin,
} from "./evaluation";

// An Evaluation as PE's server returns it (apps/web/src/features/evaluations/evaluation-client.ts
// at 5e831bb).
const evaluation = {
  band: "Natural",
  correctedText: "Run the test before you merge.",
  evaluatedAt: "2026-09-07T12:00:00.000Z",
  evaluatedEnglishWordCount: 6,
  findings: [
    {
      byteEnd: 12,
      byteStart: 8,
      category: "Spelling",
      correction: "test",
      explanation: "The word is misspelled.",
      originalText: "tset",
      severity: "Minor",
    },
  ],
  id: "evaluation-1",
  model: "openai/gpt-5.6-terra",
  originalText: "Run the tset before you merge.",
  provider: "OpenRouter",
  rubricVersion: "1",
  score: 85,
  suggestions: [
    {
      alternative: "merge it",
      byteEnd: 29,
      byteStart: 24,
      explanation:
        "The original may be valid; add the object if it is unclear.",
      originalText: "merge",
    },
  ],
  summary: "One local spelling error.",
};

const segment = {
  averageBand: "Natural",
  averageScore: 85,
  categoryDistributions: [{ category: "Spelling", findingCount: 1 }],
  categoryRecurrences: [
    { category: "Spelling", evaluationCount: 1, recurrencePercentage: 100 },
  ],
  evaluatedEnglishWordCount: 6,
  evaluationCount: 1,
  findingCount: 1,
  findingRate: 16.67,
  recurringCorrections: [
    { correction: "test", occurrenceCount: 1, originalText: "tset" },
  ],
  rubricVersion: "1",
};

// Progress evidence for one selection, as the server returns it.
const evidence = (selection: unknown) => ({
  evaluations: [
    {
      band: "Natural",
      evaluatedAt: "2026-09-07T12:00:00.000Z",
      evaluatedEnglishWordCount: 6,
      findingCount: 1,
      id: "evaluation-1",
      score: 85,
      summary: "One local spelling error.",
    },
  ],
  findings: [
    {
      category: "Spelling",
      correction: "test",
      evaluatedAt: "2026-09-07T12:00:00.000Z",
      evaluationId: "evaluation-1",
      evaluationSummary: "One local spelling error.",
      explanation: "The word is misspelled.",
      findingIndex: 0,
      originalText: "tset",
      severity: "Minor",
    },
  ],
  period: "all",
  rubricVersion: "1",
  selection,
});

describe("Evaluation contract", () => {
  it("keeps the closed value sets of Rubric Version 1 in their order", () => {
    expect(ERROR_CATEGORIES).toStrictEqual([
      "Spelling",
      "Article",
      "Verb form/tense",
      "Preposition",
      "Word choice",
      "Grammar/syntax",
      "Punctuation/capitalization",
      "Clarity",
      "Other",
    ]);
    expect(FINDING_SEVERITIES).toStrictEqual(["Minor", "Moderate", "Major"]);
    expect(PROFICIENCY_BANDS).toStrictEqual([
      "Needs revision",
      "Understandable",
      "Clear",
      "Natural",
    ]);
    expect(PROGRESS_PERIODS).toStrictEqual(["7-days", "30-days", "all"]);
  });

  it("decodes an Evaluation as the server returns it, with or without byte offsets", () => {
    const withoutOffsets = {
      ...evaluation,
      findings: evaluation.findings.map(
        ({ byteEnd: _end, byteStart: _start, ...finding }) => finding
      ),
      suggestions: [
        {
          explanation: "The original may be valid.",
          originalText: "merge",
        },
      ],
    };

    expect(Schema.decodeUnknownSync(Evaluation)(evaluation)).toStrictEqual(
      evaluation
    );
    expect(Schema.decodeUnknownSync(Evaluation)(withoutOffsets)).toStrictEqual(
      withoutOffsets
    );
  });

  it("rejects a category, severity, band or score outside Rubric Version 1", () => {
    const [finding] = evaluation.findings;
    const decode = Schema.decodeUnknownSync(Evaluation);

    expect(() =>
      decode({ ...evaluation, findings: [{ ...finding, category: "Style" }] })
    ).toThrow(
      'Expected "Spelling" | "Article" | "Verb form/tense" | "Preposition" | "Word choice" | "Grammar/syntax" | "Punctuation/capitalization" | "Clarity" | "Other"'
    );
    expect(() =>
      decode({
        ...evaluation,
        findings: [{ ...finding, severity: "Critical" }],
      })
    ).toThrow('Expected "Minor" | "Moderate" | "Major"');
    expect(() => decode({ ...evaluation, band: "Fluent" })).toThrow(
      'Expected "Needs revision" | "Understandable" | "Clear" | "Natural"'
    );
    expect(() => decode({ ...evaluation, score: 85.5 })).toThrow(
      "Expected an integer"
    );
    expect(() => decode({ ...evaluation, score: 101 })).toThrow(
      "Expected a value between 0 and 100"
    );
  });

  it("decodes both outcomes of a submission", () => {
    const decode = Schema.decodeUnknownSync(EvaluationSubmissionResult);

    expect(decode({ evaluation, kind: "created" })).toStrictEqual({
      evaluation,
      kind: "created",
    });
    expect(decode({ kind: "no-english" })).toStrictEqual({
      kind: "no-english",
    });
  });

  it("decodes the History summary, Progress and setup status", () => {
    const summary = {
      band: "Natural",
      evaluatedAt: "2026-09-07T12:00:00.000Z",
      id: "evaluation-1",
      rubricVersion: "1",
      score: 85,
      summary: "One local spelling error.",
    };
    const progress = {
      ...segment,
      incompatibleSegments: [
        {
          ...segment,
          averageBand: null,
          averageScore: null,
          findingRate: null,
          rubricVersion: "2",
        },
      ],
      period: "30-days",
    };
    const selections = [
      { kind: "finding-rate" },
      { kind: "average-score" },
      { category: "Spelling", kind: "category" },
      { correction: "test", kind: "correction", originalText: "tset" },
    ];
    // Decoded as the web app decodes a response: from JSON of unknown shape.
    const setup: unknown = {
      configured: true,
      dataLocation: "./.data/pglite",
      model: "openai/gpt-5.6-terra",
      provider: "OpenRouter",
      rubricVersion: "1",
    };

    expect(Schema.decodeUnknownSync(EvaluationSummary)(summary)).toStrictEqual(
      summary
    );
    expect(Schema.decodeUnknownSync(ProgressSummary)(progress)).toStrictEqual(
      progress
    );
    expect(
      selections.map((selection) =>
        Schema.decodeUnknownSync(ProgressEvidence)(evidence(selection))
      )
    ).toStrictEqual(selections.map((selection) => evidence(selection)));
    expect(Schema.decodeUnknownSync(SetupStatus)(setup)).toStrictEqual(setup);
  });

  it("accepts exactly the work and practice origins of a Writing Sample", () => {
    expect(WRITING_SAMPLE_ORIGINS).toStrictEqual(["work", "practice"]);
    expect(
      ["work", "practice"].map((origin) =>
        Schema.decodeUnknownSync(WritingSampleOrigin)(origin)
      )
    ).toStrictEqual(["work", "practice"]);
    expect(() =>
      Schema.decodeUnknownSync(WritingSampleOrigin)("draft")
    ).toThrow('Expected "work" | "practice"');
  });

  it("carries a Progress evidence selection in a request body, whole or not at all", () => {
    const request = {
      period: "all",
      selection: {
        correction: "an apple",
        kind: "correction",
        originalText: "a apple",
      },
    };
    const refused = [
      {
        period: "all",
        selection: { kind: "correction", originalText: "a apple" },
      },
      { period: "all", selection: { category: "Style", kind: "category" } },
      { period: "year", selection: { kind: "finding-rate" } },
      { period: "all" },
    ];

    expect(
      Schema.decodeUnknownSync(ProgressEvidenceRequest)(request)
    ).toStrictEqual(request);
    expect(
      refused.map((body) => Schema.is(ProgressEvidenceRequest)(body))
    ).toStrictEqual([false, false, false, false]);
  });
});
