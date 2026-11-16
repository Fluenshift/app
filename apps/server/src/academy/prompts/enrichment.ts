// The Enrichment: the Trainer's pass over one Evaluation's Findings, which adds what practice
// needs (docs/adr/0004). Derived from Grifando src/server/ai/prompts/writingAnalysis.ts
// (74dbb9f), keeping only the Academy fields: the Judge has already found the errors.
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

export const buildEnrichmentSystemPrompt = (): string => "";

export const buildEnrichmentUserMessage = (_input: EnrichmentInput): string =>
  "";
