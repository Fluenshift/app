// Characterization of the pure checks in apps/server/src/evaluation/live-calibration.ts at the
// PE baseline: every failure the assessment and fixture-set validators can name.
// live-calibration.test.ts reaches most of them only through the frozen fixtures, which pass.
import { describe, expect, it } from "bun:test";

import { validateFixtureAssessment, validateFixtureSet } from "./live-calibration";
import {
  LIVE_CALIBRATION_FIXTURES,
  LIVE_CALIBRATION_REQUIREMENTS,
} from "./live-calibration-fixtures";
import type { LiveCalibrationFixture } from "./live-calibration-fixtures";
import { ERROR_CATEGORIES } from "./rubric-v1";

const fixture = (id: string): LiveCalibrationFixture => {
  const found = LIVE_CALIBRATION_FIXTURES.find(
    (candidate) => candidate.id === id
  );
  if (found === undefined) {
    throw new Error(`no frozen fixture ${id}`);
  }
  return found;
};

// The UTF-8 byte span of the first occurrence of `text` in `source`.
const span = (source: string, text: string) => {
  const index = source.indexOf(text);
  if (index === -1) {
    throw new Error(`no ${text} in the sample`);
  }
  const byteStart = Buffer.byteLength(source.slice(0, index), "utf-8");
  return {
    byteEnd: byteStart + Buffer.byteLength(text, "utf-8"),
    byteStart,
    originalText: text,
  };
};

// The failures of a fixture set apart from what it fails to cover.
const definitionFailures = (fixtures: readonly LiveCalibrationFixture[]) =>
  validateFixtureSet(fixtures).filter(
    (failure) => !failure.startsWith("missing ")
  );

const contextExplanation =
  "The original may be valid; quick suits the context if speed is the intent.";

const longNonEnglish =
  "Não altere isto porque a equipe precisa revisar cada linha com calma antes de publicar a versão final para todos os usuários.";

describe("validateFixtureAssessment guards", () => {
  it("names a changed severity, original text and correction of a Finding", () => {
    const spelling = fixture("spelling-minor-a");
    const article = fixture("article-minor");

    expect(
      validateFixtureAssessment(spelling, {
        findings: [
          {
            ...span(spelling.writingSample, "fails"),
            category: "Spelling",
            correction: "fail",
            explanation: "Changed.",
            severity: "Major",
          },
        ],
        nonEnglishSpans: [],
        suggestions: [],
        summary: "Changed.",
      })
    ).toEqual([
      "finding 1 severity: expected Minor, got Major",
      'finding 1 originalText: expected "tset", got "fails"',
      'finding 1 correction: expected "test", got "fail"',
    ]);
    expect(
      validateFixtureAssessment(article, {
        findings: [
          {
            ...span(article.writingSample, "update"),
            category: "Article",
            correction: "updates",
            explanation: "Changed.",
            severity: "Minor",
          },
        ],
        nonEnglishSpans: [],
        suggestions: [],
        summary: "Changed.",
      })
    ).toEqual([
      'finding 1 originalText: expected "a" or "a update", got "update"',
      'finding 1 correction: expected "an" or "an update", got "updates"',
    ]);
  });

  it("counts the Findings and compares each expected one at its position", () => {
    const spelling = fixture("spelling-minor-a");
    const tset = {
      ...span(spelling.writingSample, "tset"),
      category: "Spelling" as const,
      correction: "test",
      explanation: "The word is misspelled.",
      severity: "Minor" as const,
    };
    const fails = {
      ...span(spelling.writingSample, "fails"),
      category: "Verb form/tense" as const,
      correction: "failed",
      explanation: "The tense changed.",
      severity: "Minor" as const,
    };
    const assess = (findings: (typeof tset | typeof fails)[]) =>
      validateFixtureAssessment(spelling, {
        findings,
        nonEnglishSpans: [],
        suggestions: [],
        summary: "Assessed.",
      });

    expect(assess([])).toEqual(["findings: expected 1, got 0"]);
    expect(assess([tset, fails])).toEqual(["findings: expected 1, got 2"]);
    expect(assess([fails, tset])).toEqual([
      "findings: expected 1, got 2",
      "finding 1 category: expected Spelling, got Verb form/tense",
      'finding 1 originalText: expected "tset", got "fails"',
      'finding 1 correction: expected "test", got "failed"',
    ]);
  });

  it("checks context suggestions: their count, alternative, original text and explanation", () => {
    const context = fixture("context-dependent-alternative");
    const correct = fixture("correct-english");
    const fast = span(context.writingSample, "fast");
    const assess = (
      suggestions: {
        readonly alternative?: string;
        readonly byteEnd: number;
        readonly byteStart: number;
        readonly explanation: string;
        readonly originalText: string;
      }[]
    ) =>
      validateFixtureAssessment(context, {
        findings: [],
        nonEnglishSpans: [],
        suggestions,
        summary: "One optional alternative.",
      });
    const valid = {
      ...fast,
      alternative: "quick",
      explanation: contextExplanation,
    };

    expect(assess([])).toEqual([]);
    expect(assess([valid])).toEqual([]);
    expect(assess([{ ...valid, explanation: "Quick is shorter." }])).toEqual([
      "suggestion 1 explanation: must say the original is not confirmed wrong",
      "suggestion 1 explanation: must identify the missing context",
    ]);
    expect(assess([{ ...valid, alternative: "rapid" }])).toEqual([
      "suggestion 1 alternative: unexpected value",
    ]);
    expect(assess([{ ...fast, explanation: contextExplanation }])).toEqual([
      "suggestion 1 alternative: unexpected value",
    ]);
    expect(assess([valid, valid])).toEqual([
      "suggestions: expected at most 1, got 2",
    ]);
    expect(
      validateFixtureAssessment(
        {
          ...correct,
          expected: {
            ...correct.expected,
            suggestions: [
              {
                originalText: ["test"],
                requireMissingContext: true,
                requireNonErrorLabel: true,
              },
            ],
          },
        },
        {
          findings: [],
          nonEnglishSpans: [],
          suggestions: [
            {
              ...span(correct.writingSample, "fails"),
              explanation: contextExplanation,
            },
          ],
          summary: "One optional alternative.",
        }
      )
    ).toEqual(['suggestion 1 originalText: expected "test", got "fails"']);
  });

  it("refuses feedback on Protected Technical Content, overlapping Findings, Findings on non-English text and no-op corrections", () => {
    const fenced = fixture("protected-fenced-code");
    const spelling = fixture("spelling-minor-a");
    const mixed = fixture("mixed-language");
    const nonEnglish = span(mixed.writingSample, "Não altere isto.");

    expect(
      validateFixtureAssessment(fenced, {
        findings: [
          {
            ...span(fenced.writingSample, "are"),
            category: "Grammar/syntax",
            correction: "is",
            explanation: "Agreement.",
            severity: "Minor",
          },
        ],
        nonEnglishSpans: [],
        suggestions: [],
        summary: "Assessed.",
      })
    ).toEqual([
      "findings: expected 0, got 1",
      "feedback overlaps Protected Technical Content",
    ]);
    expect(
      validateFixtureAssessment(spelling, {
        findings: [
          {
            ...span(spelling.writingSample, "tset"),
            category: "Spelling",
            correction: "test",
            explanation: "The word is misspelled.",
            severity: "Minor",
          },
          {
            ...span(spelling.writingSample, "tset fails"),
            category: "Spelling",
            correction: "tset fails",
            explanation: "Unchanged.",
            severity: "Minor",
          },
        ],
        nonEnglishSpans: [],
        suggestions: [],
        summary: "Assessed.",
      })
    ).toEqual([
      "findings: expected 1, got 2",
      "findings overlap",
      "a Finding contains a no-op correction",
    ]);
    expect(
      validateFixtureAssessment(mixed, {
        findings: [
          {
            ...span(mixed.writingSample, "teh"),
            category: "Spelling",
            correction: "the",
            explanation: "The word is misspelled.",
            severity: "Minor",
          },
          {
            ...span(mixed.writingSample, "altere"),
            category: "Spelling",
            correction: "altera",
            explanation: "Changed.",
            severity: "Minor",
          },
        ],
        nonEnglishSpans: [nonEnglish],
        suggestions: [],
        summary: "Assessed.",
      })
    ).toEqual([
      "findings: expected 1, got 2",
      "a Finding overlaps non-English text",
    ]);
  });

  it("names a non-English span whose bytes differ from the declared one", () => {
    const mixed = fixture("mixed-language");

    expect(
      validateFixtureAssessment(mixed, {
        findings: [
          {
            ...span(mixed.writingSample, "teh"),
            category: "Spelling",
            correction: "the",
            explanation: "The word is misspelled.",
            severity: "Minor",
          },
        ],
        nonEnglishSpans: [span(mixed.writingSample, "altere isto.")],
        suggestions: [],
        summary: "Assessed.",
      })
    ).toEqual(["non-English span 1: expected exact UTF-8 bytes"]);
  });
});

describe("validateFixtureSet guards", () => {
  it("names duplicate, unstable and blank fixtures, a consistency fixture without exactly one Finding and a non-English span that is not unique", () => {
    const correct = fixture("correct-english");
    const allNonEnglish = fixture("all-non-english");

    expect(
      definitionFailures([
        correct,
        correct,
        { ...correct, id: "Correct_English" },
        { ...correct, id: "blank-sample", writingSample: "   " },
        { ...correct, consistencyRepetitions: 2, id: "repeated-without-finding" },
        {
          ...allNonEnglish,
          id: "repeated-span",
          writingSample: "Olá mundo. Olá mundo.",
        },
      ])
    ).toEqual([
      "duplicate fixture id: correct-english",
      "unstable fixture id: Correct_English",
      "empty fixture: blank-sample",
      "consistency fixture must declare exactly one Finding: repeated-without-finding",
      "non-English span is not unique: repeated-span",
    ]);
  });

  it("throws when an evaluated fixture declares a non-English span that is not unique", () => {
    const mixed = fixture("mixed-language");

    expect(() =>
      validateFixtureSet([
        {
          ...mixed,
          id: "repeated-mixed",
          writingSample: "Please fix teh text.\nNão altere isto. Não altere isto.",
        },
      ])
    ).toThrow('Frozen expected span must occur exactly once: "Não altere isto."');
  });

  it("derives score and band from English words only, outside non-English and protected text", () => {
    const mixed = fixture("mixed-language");
    const longExcluded = {
      ...mixed,
      expected: { ...mixed.expected, nonEnglishSpans: [longNonEnglish] },
      id: "long-excluded-spans",
      writingSample: `Please fix teh text.\n${longNonEnglish}\n\`\`\`txt\nThis block are broken and it stay outside the count because every word in protected technical content is excluded from scoring.\n\`\`\``,
    };

    expect(definitionFailures([longExcluded])).toEqual([]);
    expect(
      definitionFailures([
        {
          ...longExcluded,
          expected: { ...longExcluded.expected, score: 94 },
          id: "every-word-counted",
        },
      ])
    ).toEqual(["score mismatch: every-word-counted expected 94, derived 85"]);
  });

  it("names a score and band that the rubric does not derive", () => {
    const spelling = fixture("spelling-minor-a");

    expect(
      definitionFailures([
        {
          ...spelling,
          expected: { ...spelling.expected, band: "Clear", score: 90 },
          id: "wrong-score",
        },
      ])
    ).toEqual([
      "score mismatch: wrong-score expected 90, derived 85",
      "band mismatch: wrong-score expected Clear, derived Natural",
    ]);
  });

  it("names every category, repeated consistency case, severity and requirement the set misses", () => {
    expect(validateFixtureSet([])).toEqual([
      ...ERROR_CATEGORIES.flatMap((category) => [
        `missing category: ${category}`,
        `missing repeated consistency case: ${category}`,
      ]),
      "missing severity: Minor",
      "missing severity: Moderate",
      "missing severity: Major",
      ...LIVE_CALIBRATION_REQUIREMENTS.map(
        (requirement) => `missing requirement: ${requirement}`
      ),
    ]);
    expect(
      validateFixtureSet(
        LIVE_CALIBRATION_FIXTURES.map(
          ({ consistencyRepetitions: _repetitions, ...unrepeated }) => unrepeated
        )
      )
    ).toEqual(
      ERROR_CATEGORIES.map(
        (category) => `missing repeated consistency case: ${category}`
      )
    );
  });
});
