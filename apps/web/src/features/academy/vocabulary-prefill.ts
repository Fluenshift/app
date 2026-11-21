// The prefill of the vocabulary form: "Save to vocabulary" hands the /vocabulary page a term, its
// example and the source Evaluation in the router's history state, never in the URL, where
// Grifando put them (docs/adr/0025). A reload in the same tab keeps it; a shared link opens an
// empty form.
export interface VocabularyPrefill {
  readonly example: string;
  readonly sourceEvaluationId?: string;
  readonly term: string;
}

declare module "@tanstack/react-router" {
  interface HistoryState {
    readonly vocabularyPrefill?: VocabularyPrefill;
  }
}
