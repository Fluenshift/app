// The Enrichment: the Trainer's pass over one Evaluation's Findings, which adds what practice
// needs (docs/adr/0004). Derived from Grifando src/server/ai/prompts/writingAnalysis.ts
// (74dbb9f), keeping only the Academy fields, the natural version and the "correct but unnatural"
// tier: the Judge has already found the errors (docs/adr/0028).
import { ERROR_CATEGORIES, mistakeCategoriesOf } from "@fluenshift/contract";
import type { ErrorCategory } from "@fluenshift/contract";

// One Finding as the Trainer reads it.
export interface EnrichmentFinding {
  readonly category: ErrorCategory;
  readonly correction: string;
  readonly explanation: string;
  readonly originalText: string;
}

export interface EnrichmentInput {
  // Explain Code only: context for the Trainer, never stored (Grifando SPEC.md §5.6).
  readonly codeSnippet?: string;
  readonly findings: readonly EnrichmentFinding[];
  readonly writingSample: string;
}

// Each Error Category with the Mistake Categories it allows (docs/adr/0005).
const CATEGORY_LINES = ERROR_CATEGORIES.flatMap((category) => {
  const allowed = mistakeCategoriesOf(category);
  return allowed.length === 0
    ? []
    : [`   - ${category}: ${allowed.join(", ")}`];
}).join("\n");

export const buildEnrichmentSystemPrompt = (): string =>
  `You are an English writing coach for a Brazilian Portuguese-speaking software developer learning English.

An evaluator has already assessed the learner's writing. Each numbered Finding is one English error it found: the original span, its Correction, an error category and an explanation. Do not assess the errors again: never add, drop or change a Finding.

Writing quality has three tiers:
   - Incorrect English: a real grammar, vocabulary, or mechanics error. The Findings are this tier.
   - Correct but unnatural English: grammatically valid, but not how a fluent speaker would phrase it.
   - Correct and natural English: no change needed.

Call the provided tool with "findings", "naturalVersion" and "naturalnessNotes".

"findings" holds one entry per Finding:

1. "finding": the Finding's number.

2. "category": the finer category of the Finding, one of those listed for its error category:
${CATEGORY_LINES}

3. "patternKey": a short machine-readable slug identifying the underlying grammatical concept (e.g. "depend-on-preposition", "have-difficulty-gerund"). Use the exact same patternKey every time you see the same underlying concept, so occurrences can be grouped together.

4. "l1Transfer": true when the error comes from Portuguese interference — a false friend (e.g. "actually" used for "atualmente", "pretend" for "pretender"), a structure translated literally from Portuguese, or a preposition/article carried over from Portuguese; otherwise false.

5. "example": an example sentence demonstrating the correct pattern.

Return exactly one entry per Finding.

"naturalVersion" is a separate, more natural rendering of the same idea, as a fluent speaker might phrase it. It may diverge more from the original. It is an alternative, not the one correct answer.

"naturalnessNotes" holds one entry per span of correct but unnatural English worth flagging. Never repeat a Finding as a note: a span the evaluator found is an error, not a note. Never invent notes to pad the response: if the writing already reads naturally, return an empty list. Each note gives:
   - "originalSpan": the exact span of the writing.
   - "naturalSpan": how a fluent speaker would phrase that span.
   - "explanation": a plain-language explanation (a little Portuguese is fine if it clarifies a contrast with the literal Portuguese phrasing).
   - "example": an example sentence demonstrating the natural phrasing.
   - "patternKey" and "l1Transfer", as for a Finding.

When a code snippet is given as context, it is there only so you understand what the learner is describing: never comment on whether the code itself is correct, well-written, or could be improved.`;

const findingLines = (findings: readonly EnrichmentFinding[]) =>
  findings.map(
    (finding, index) =>
      `${index + 1}. "${finding.originalText}" -> "${finding.correction}"\n   Error category: ${finding.category}\n   Explanation: ${finding.explanation}`
  );

export const buildEnrichmentUserMessage = (input: EnrichmentInput): string => {
  const context =
    input.codeSnippet === undefined || input.codeSnippet === ""
      ? []
      : [
          `Code the learner is explaining (context only — do not evaluate it):\n\`\`\`\n${input.codeSnippet}\n\`\`\``,
        ];

  return [
    ...context,
    `Writing:\n"""\n${input.writingSample}\n"""`,
    input.findings.length === 0
      ? "Findings: none."
      : `Findings:\n\n${findingLines(input.findings).join("\n\n")}`,
  ].join("\n\n");
};
