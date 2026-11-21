// The Enrichment's prompt. No Grifando test covers it: it replaces the writing analysis prompt
// (docs/adr/0004), whose cases are superseded, and these cases follow theirs.
import { describe, expect, it } from "vitest";

import {
  buildEnrichmentSystemPrompt,
  buildEnrichmentUserMessage,
} from "./enrichment";
import type { EnrichmentInput } from "./enrichment";

const input: EnrichmentInput = {
  findings: [
    {
      category: "Preposition",
      correction: "depend on",
      explanation: "Use 'depend on', not 'depend of'.",
      originalText: "depend of",
    },
    {
      category: "Article",
      correction: "it",
      explanation: "No article before a pronoun.",
      originalText: "the it",
    },
  ],
  writingSample: "I depend of the it.",
};

describe("buildEnrichmentSystemPrompt", () => {
  it("offers each Error Category only its own Mistake Categories", () => {
    const prompt = buildEnrichmentSystemPrompt();

    expect(prompt).toContain("- Article: ARTICLES\n");
    expect(prompt).toContain(
      "- Verb form/tense: VERB_TENSE, SUBJECT_VERB_AGREEMENT\n"
    );
    expect(prompt).toContain("- Word choice: VOCABULARY, COLLOCATION\n");
    expect(prompt).toContain(
      "- Grammar/syntax: WORD_ORDER, PRONOUNS, COUNTABLE_UNCOUNTABLE\n"
    );
    expect(prompt).not.toContain("UNNATURAL_PHRASING");
    expect(prompt).not.toContain("LITERAL_TRANSLATION");
    expect(prompt).not.toContain("Clarity");
  });

  it("asks for a pattern key, the L1 Transfer flag and an example per Finding", () => {
    const prompt = buildEnrichmentSystemPrompt();

    expect(prompt).toContain('"patternKey"');
    expect(prompt).toContain('"l1Transfer"');
    expect(prompt).toContain("Portuguese interference");
    expect(prompt).toContain('"example"');
    expect(prompt).toContain("Return exactly one entry per Finding.");
  });

  it("asks for a natural version of the whole Writing Sample, as one option", () => {
    const prompt = buildEnrichmentSystemPrompt();

    expect(prompt).toContain('"naturalVersion"');
    expect(prompt).toContain(
      "a separate, more natural rendering of the same idea, as a fluent speaker might phrase it"
    );
    expect(prompt).toContain(
      "It is an alternative, not the one correct answer."
    );
  });

  it("asks for Naturalness Notes on correct but unnatural spans only, never on a Finding", () => {
    const prompt = buildEnrichmentSystemPrompt();

    expect(prompt).toContain('"naturalnessNotes"');
    expect(prompt).toContain(
      "Correct but unnatural English: grammatically valid, but not how a fluent speaker would phrase it."
    );
    expect(prompt).toContain('"originalSpan"');
    expect(prompt).toContain('"naturalSpan"');
    expect(prompt).toContain("Never repeat a Finding as a note");
    expect(prompt).toContain(
      "Never invent notes to pad the response: if the writing already reads naturally, return an empty list."
    );
  });

  it("instructs the model not to evaluate code it is given as context", () => {
    expect(buildEnrichmentSystemPrompt()).toContain(
      "never comment on whether the code itself is correct"
    );
  });
});

describe("buildEnrichmentUserMessage", () => {
  it("numbers every Finding with its span, Correction, Error Category and explanation", () => {
    const message = buildEnrichmentUserMessage(input);

    expect(message).toContain(
      "1. \"depend of\" -> \"depend on\"\n   Error category: Preposition\n   Explanation: Use 'depend on', not 'depend of'."
    );
    expect(message).toContain(
      '2. "the it" -> "it"\n   Error category: Article\n   Explanation: No article before a pronoun.'
    );
  });

  it("says so when the Judge found no Finding", () => {
    const message = buildEnrichmentUserMessage({
      findings: [],
      writingSample: "I depend on it.",
    });

    expect(message).toContain("Findings: none.");
    expect(message).not.toContain("Findings:\n");
  });

  it("includes the Writing Sample verbatim", () => {
    expect(buildEnrichmentUserMessage(input)).toContain(
      '"""\nI depend of the it.\n"""'
    );
  });

  it("includes the code snippet when present", () => {
    const message = buildEnrichmentUserMessage({
      ...input,
      codeSnippet: "export async function registerUser() {}",
    });

    expect(message).toContain(
      "```\nexport async function registerUser() {}\n```"
    );
    expect(message).toContain("context only");
  });

  it("omits the code snippet line when absent", () => {
    expect(buildEnrichmentUserMessage(input)).not.toContain("```");
  });
});
