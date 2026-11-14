import type {
  EvaluationFinding,
  EvaluationSuggestion,
} from "@fluenshift/contract";

export interface TextMark {
  readonly end: number;
  readonly finding?: EvaluationFinding;
  readonly id: string;
  readonly index: number;
  readonly kind: "finding" | "suggestion";
  readonly originalText: string;
  readonly start: number;
  readonly suggestion?: EvaluationSuggestion;
}

export interface SpellCheckerProps {
  readonly activeMarkId?: string | null;
  readonly className?: string;
  readonly containerClassName?: string;
  readonly findings?: readonly EvaluationFinding[];
  readonly onAccept?: (mark: TextMark) => void;
  readonly onAcceptAll?: () => void;
  readonly onActiveMarkChange?: (id: string | null) => void;
  readonly onDismiss?: (mark: TextMark) => void;
  readonly readOnly?: boolean;
  readonly suggestions?: readonly EvaluationSuggestion[];
  readonly text: string;
}

export const SpellChecker = (_props: SpellCheckerProps) => <div />;

export const buildTextSpans = (
  _text: string,
  _findings: readonly EvaluationFinding[] = [],
  _suggestions: readonly EvaluationSuggestion[] = []
): TextMark[] => [];
