// The read-only view of a Writing Sample with its Findings and Suggestions marked inline. Ported
// from PE apps/web/src/features/evaluations/spell-checker.tsx (5e831bb).
import type {
  EvaluationFinding,
  EvaluationSuggestion,
} from "@grifando/contract";
import { Button } from "@grifando/ui/components/button";
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from "@grifando/ui/components/popover";
import { cn } from "@grifando/ui/utils";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  X,
} from "lucide-react";
import * as React from "react";

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

const NO_FINDINGS: readonly EvaluationFinding[] = [];
const NO_SUGGESTIONS: readonly EvaluationSuggestion[] = [];

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder();

/** Convert UTF-8 byte offsets to JS character offsets if they match the expected text. */
const byteRangeToCharRange = (
  bytes: Uint8Array,
  byteStart?: number,
  byteEnd?: number,
  expected?: string
): { end: number; start: number } | null => {
  if (
    byteStart === undefined ||
    byteEnd === undefined ||
    byteStart < 0 ||
    byteEnd > bytes.length ||
    byteStart >= byteEnd
  ) {
    return null;
  }
  const slice = bytes.subarray(byteStart, byteEnd);
  const decoded = utf8Decoder.decode(slice);
  if (expected !== undefined && decoded !== expected) {
    return null;
  }
  const charStart = utf8Decoder.decode(bytes.subarray(0, byteStart)).length;
  return { end: charStart + decoded.length, start: charStart };
};

export const buildTextSpans = (
  text: string,
  findings: readonly EvaluationFinding[] = [],
  suggestions: readonly EvaluationSuggestion[] = []
): TextMark[] => {
  const marks: TextMark[] = [];
  const bytes = utf8Encoder.encode(text);

  const isOccupied = (start: number, end: number) =>
    marks.some((m) => start < m.end && end > m.start);

  // The byte range when it holds the text and is free, otherwise the next free occurrence of
  // the text after the cursor, or from the start.
  const locate = (
    item: EvaluationFinding | EvaluationSuggestion,
    searchCursor: number
  ) => {
    let range = byteRangeToCharRange(
      bytes,
      item.byteStart,
      item.byteEnd,
      item.originalText
    );
    let cursor = searchCursor;

    if (!range || isOccupied(range.start, range.end)) {
      let idx = text.indexOf(item.originalText, searchCursor);
      if (idx === -1) {
        idx = text.indexOf(item.originalText, 0);
      }
      if (idx !== -1 && !isOccupied(idx, idx + item.originalText.length)) {
        range = { end: idx + item.originalText.length, start: idx };
        cursor = range.end;
      }
    }

    return { cursor, range };
  };

  let searchCursor = 0;

  // Process findings first (demonstrable errors take precedence)
  for (const [i, finding] of findings.entries()) {
    const { cursor, range } = locate(finding, searchCursor);
    searchCursor = cursor;

    if (range) {
      marks.push({
        end: range.end,
        finding,
        id: `finding-${i}`,
        index: marks.length,
        kind: "finding",
        originalText: finding.originalText,
        start: range.start,
      });
    }
  }

  // Process suggestions
  searchCursor = 0;
  for (const [i, suggestion] of suggestions.entries()) {
    const { cursor, range } = locate(suggestion, searchCursor);
    searchCursor = cursor;

    if (range) {
      marks.push({
        end: range.end,
        id: `suggestion-${i}`,
        index: marks.length,
        kind: "suggestion",
        originalText: suggestion.originalText,
        start: range.start,
        suggestion,
      });
    }
  }

  // Sort by start position
  return marks.toSorted((a, b) => a.start - b.start);
};

type TextSegment =
  | { readonly kind: "mark"; readonly mark: TextMark; readonly text: string }
  | { readonly kind: "text"; readonly text: string };

const buildSegments = (
  text: string,
  marks: readonly TextMark[]
): TextSegment[] => {
  const segments: TextSegment[] = [];
  let cursor = 0;

  for (const mark of marks) {
    if (mark.start > cursor) {
      segments.push({
        kind: "text",
        text: text.slice(cursor, mark.start),
      });
    }
    segments.push({
      kind: "mark",
      mark,
      text: text.slice(mark.start, mark.end),
    });
    cursor = mark.end;
  }

  if (cursor < text.length) {
    segments.push({
      kind: "text",
      text: text.slice(cursor),
    });
  }

  return segments;
};

interface MarkCardProps {
  readonly isActive: boolean;
  readonly mark: TextMark;
  readonly markIndex: number;
  readonly onAccept: ((mark: TextMark) => void) | undefined;
  readonly onDismiss: ((mark: TextMark) => void) | undefined;
  readonly onNavigate: (direction: -1 | 1) => void;
  readonly readOnly: boolean;
  readonly setActiveId: (id: string | null) => void;
  readonly text: string;
  readonly markCount: number;
}

/** The replacement a Finding proposes: a button that accepts it, or the correction as read. */
const FindingReplacement = ({
  finding,
  onAccept,
}: {
  readonly finding: EvaluationFinding;
  readonly onAccept: (() => void) | undefined;
}) => (
  <div>
    {onAccept ? (
      <button
        className="group flex w-full cursor-pointer items-center justify-between rounded-lg bg-emerald-600 px-3 py-2 text-left text-white shadow-xs transition-all hover:bg-emerald-700 active:scale-[0.99] dark:bg-emerald-700 dark:hover:bg-emerald-600"
        onClick={onAccept}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Check className="size-4 shrink-0" />
          <span className="truncate text-sm font-semibold">
            {finding.correction}
          </span>
        </span>
        <span className="shrink-0 text-[11px] font-medium opacity-90 group-hover:opacity-100">
          Accept
        </span>
      </button>
    ) : (
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-emerald-800 dark:text-emerald-200">
        <span className="block text-[10px] font-bold tracking-wider uppercase opacity-80">
          Correction
        </span>
        <span className="text-sm font-semibold">{finding.correction}</span>
      </div>
    )}
  </div>
);

/** The wording a Suggestion proposes: a button that uses it, or the alternative as read. */
const SuggestionAlternative = ({
  alternative,
  onAccept,
}: {
  readonly alternative: string;
  readonly onAccept: (() => void) | undefined;
}) => (
  <div>
    {onAccept ? (
      <button
        className="group flex w-full cursor-pointer items-center justify-between rounded-lg bg-amber-600 px-3 py-2 text-left text-white shadow-xs transition-all hover:bg-amber-700 active:scale-[0.99] dark:bg-amber-700 dark:hover:bg-amber-600"
        onClick={onAccept}
        type="button"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Sparkles className="size-4 shrink-0" />
          <span className="truncate text-sm font-semibold">{alternative}</span>
        </span>
        <span className="shrink-0 text-[11px] font-medium opacity-90 group-hover:opacity-100">
          Use wording
        </span>
      </button>
    ) : (
      <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-amber-800 dark:text-amber-200">
        <span className="block text-[10px] font-bold tracking-wider uppercase opacity-80">
          Alternative
        </span>
        <span className="text-sm font-semibold">{alternative}</span>
      </div>
    )}
  </div>
);

/** The card's header: the Error Category and severity of a Finding, or the optional wording. */
const MarkCardHeader = ({
  isFinding,
  mark,
  markIndex,
  markCount,
}: {
  readonly isFinding: boolean;
  readonly mark: TextMark;
  readonly markIndex: number;
  readonly markCount: number;
}) => (
  <div
    className={cn(
      "flex items-center justify-between border-b px-3.5 py-2.5",
      isFinding ? "bg-destructive/10" : "bg-amber-500/10"
    )}
  >
    <div className="flex min-w-0 items-center gap-1.5">
      {isFinding ? (
        <AlertCircle className="text-destructive size-3.5 shrink-0" />
      ) : (
        <Sparkles className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
      )}
      <span className="truncate text-xs font-semibold">
        {isFinding ? `${mark.finding?.category}` : "Optional wording"}
      </span>
      {isFinding ? (
        <span className="py-0.2 bg-background text-muted-foreground shrink-0 rounded-full border px-1.5 text-[10px] font-bold tracking-wider uppercase">
          {mark.finding?.severity}
        </span>
      ) : null}
    </div>

    <div className="flex items-center gap-1">
      <span className="text-muted-foreground text-[10px] tabular-nums">
        {markIndex + 1} of {markCount}
      </span>
      <PopoverClose
        aria-label="Close"
        className="text-muted-foreground hover:text-foreground rounded-sm p-0.5 transition-colors outline-none"
      >
        <X className="size-3.5" />
      </PopoverClose>
    </div>
  </div>
);

/** The card's footer: the stepper through the marks and, when allowed, the dismissal. */
const MarkCardFooter = ({
  mark,
  onDismiss,
  onNavigate,
  setActiveId,
  markCount,
}: {
  readonly mark: TextMark;
  readonly onDismiss: ((mark: TextMark) => void) | undefined;
  readonly onNavigate: (direction: -1 | 1) => void;
  readonly setActiveId: (id: string | null) => void;
  readonly markCount: number;
}) => (
  <div className="bg-muted/30 flex items-center justify-between border-t px-3.5 py-2 text-xs">
    <div className="flex items-center gap-1">
      <Button
        aria-label="Previous"
        className="size-6 p-0"
        disabled={markCount <= 1}
        onClick={() => onNavigate(-1)}
        size="icon-xs"
        type="button"
        variant="ghost"
      >
        <ChevronLeft className="size-3" />
      </Button>
      <Button
        aria-label="Next"
        className="size-6 p-0"
        disabled={markCount <= 1}
        onClick={() => onNavigate(1)}
        size="icon-xs"
        type="button"
        variant="ghost"
      >
        <ChevronRight className="size-3" />
      </Button>
    </div>

    {onDismiss ? (
      <Button
        className="text-muted-foreground hover:text-foreground h-6 px-2 text-[11px]"
        onClick={() => {
          onDismiss(mark);
          setActiveId(null);
        }}
        size="xs"
        type="button"
        variant="ghost"
      >
        Dismiss
      </Button>
    ) : null}
  </div>
);

/** One marked span and the card that opens from it. */
const MarkCard = ({
  isActive,
  mark,
  markIndex,
  onAccept,
  onDismiss,
  onNavigate,
  readOnly,
  setActiveId,
  text,
  markCount,
}: MarkCardProps) => {
  const isFinding = mark.kind === "finding";
  const accept =
    !readOnly && onAccept
      ? () => {
          onAccept(mark);
          setActiveId(null);
        }
      : undefined;

  return (
    <Popover
      modal={false}
      onOpenChange={(open) => {
        setActiveId(open ? mark.id : null);
      }}
      open={isActive}
    >
      <PopoverTrigger
        aria-label={`${isFinding ? "Finding" : "Suggestion"}: ${mark.originalText}`}
        className={cn(
          "font-inherit inline cursor-pointer rounded-xs px-0.5 py-0.5 text-inherit underline decoration-wavy decoration-2 underline-offset-4 transition-all outline-none",
          isFinding
            ? "decoration-destructive bg-destructive/10 hover:bg-destructive/20 focus-visible:ring-destructive/60 focus-visible:ring-2"
            : "bg-amber-500/10 decoration-amber-500 hover:bg-amber-500/20 focus-visible:ring-2 focus-visible:ring-amber-500/60",
          isActive &&
            (isFinding
              ? "bg-destructive/25 ring-destructive/70 ring-2 ring-offset-1"
              : "bg-amber-500/25 ring-2 ring-amber-500/70 ring-offset-1")
        )}
      >
        {text}
      </PopoverTrigger>

      <PopoverContent
        align="center"
        className="w-80 overflow-hidden rounded-xl border p-0 shadow-2xl"
        side="bottom"
        sideOffset={8}
      >
        <MarkCardHeader
          isFinding={isFinding}
          mark={mark}
          markIndex={markIndex}
          markCount={markCount}
        />

        {/* Popover Body */}
        <div className="space-y-3 p-3.5">
          {/* Original Strikethrough & Suggested Replacement */}
          <div className="space-y-2">
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground/70 text-[11px] font-medium tracking-wider uppercase">
                Original:
              </span>
              <span className="decoration-destructive/60 text-foreground font-medium line-through">
                {mark.originalText}
              </span>
            </div>

            {isFinding && mark.finding ? (
              <FindingReplacement finding={mark.finding} onAccept={accept} />
            ) : null}

            {!isFinding && mark.suggestion?.alternative ? (
              <SuggestionAlternative
                alternative={mark.suggestion.alternative}
                onAccept={accept}
              />
            ) : null}
          </div>

          {/* Explanation */}
          <p className="text-muted-foreground text-xs leading-5 break-words">
            {isFinding
              ? mark.finding?.explanation
              : mark.suggestion?.explanation}
          </p>
        </div>

        <MarkCardFooter
          mark={mark}
          onDismiss={readOnly ? undefined : onDismiss}
          onNavigate={onNavigate}
          setActiveId={setActiveId}
          markCount={markCount}
        />
      </PopoverContent>
    </Popover>
  );
};

export const SpellChecker = ({
  activeMarkId: controlledActiveId,
  className,
  containerClassName,
  findings = NO_FINDINGS,
  onAccept,
  onAcceptAll,
  onActiveMarkChange,
  onDismiss,
  readOnly = false,
  suggestions = NO_SUGGESTIONS,
  text,
}: SpellCheckerProps) => {
  const [internalActiveId, setInternalActiveId] = React.useState<string | null>(
    null
  );
  const activeId =
    controlledActiveId === undefined ? internalActiveId : controlledActiveId;

  const setActiveId = React.useCallback(
    (id: string | null) => {
      setInternalActiveId(id);
      onActiveMarkChange?.(id);
    },
    [onActiveMarkChange]
  );

  const marks = React.useMemo(
    () => buildTextSpans(text, findings, suggestions),
    [text, findings, suggestions]
  );

  const segments = React.useMemo(
    () => buildSegments(text, marks),
    [text, marks]
  );

  const activeMarkIndex = marks.findIndex((m) => m.id === activeId);

  const handleNavigate = React.useCallback(
    (direction: -1 | 1) => {
      if (marks.length === 0) {
        return;
      }
      if (activeMarkIndex === -1) {
        const edge = direction === 1 ? marks.at(0) : marks.at(-1);
        setActiveId(edge?.id ?? null);
        return;
      }
      const nextIndex =
        (activeMarkIndex + direction + marks.length) % marks.length;
      setActiveId(marks.at(nextIndex)?.id ?? null);
    },
    [activeMarkIndex, marks, setActiveId]
  );

  const findingCount = marks.filter((m) => m.kind === "finding").length;
  const suggestionCount = marks.filter((m) => m.kind === "suggestion").length;
  const markCount = marks.length;

  return (
    <div
      className={cn(
        "bg-background/90 flex flex-col rounded-xl border shadow-xs transition-all",
        containerClassName
      )}
      data-slot="spell-checker"
    >
      {/* SpellChecker Toolbar */}
      <div className="bg-muted/30 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5 text-xs">
        <div className="flex items-center gap-2">
          {markCount > 0 ? (
            <div className="flex items-center gap-1.5 font-medium">
              <span className="bg-destructive flex size-2 animate-pulse rounded-full" />
              <span>
                {markCount} {markCount === 1 ? "issue" : "issues"} detected
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-3.5" />
              <span>All clear · No errors found</span>
            </div>
          )}

          {findingCount > 0 ? (
            <span className="bg-destructive/10 text-destructive rounded-full px-2 py-0.5 text-[11px] font-semibold">
              {findingCount} {findingCount === 1 ? "error" : "errors"}
            </span>
          ) : null}

          {suggestionCount > 0 ? (
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
              {suggestionCount}{" "}
              {suggestionCount === 1 ? "suggestion" : "suggestions"}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {markCount > 0 ? (
            <div className="flex items-center gap-1">
              <Button
                aria-label="Previous issue"
                className="size-6 p-0"
                onClick={() => handleNavigate(-1)}
                size="icon-xs"
                type="button"
                variant="ghost"
              >
                <ChevronLeft className="size-3" />
              </Button>
              <span className="text-muted-foreground text-[11px] tabular-nums">
                {activeMarkIndex === -1 ? 1 : activeMarkIndex + 1} of{" "}
                {markCount}
              </span>
              <Button
                aria-label="Next issue"
                className="size-6 p-0"
                onClick={() => handleNavigate(1)}
                size="icon-xs"
                type="button"
                variant="ghost"
              >
                <ChevronRight className="size-3" />
              </Button>
            </div>
          ) : null}

          {!readOnly && onAcceptAll && findingCount > 1 ? (
            <Button
              className="h-6 gap-1 rounded-md px-2 text-[11px]"
              onClick={onAcceptAll}
              size="xs"
              type="button"
              variant="outline"
            >
              <Sparkles className="size-3" />
              Accept all ({findingCount})
            </Button>
          ) : null}
        </div>
      </div>

      {/* Interactive Text Display */}
      <div
        className={cn(
          "min-h-[14rem] p-5 text-base leading-8 break-words whitespace-pre-wrap",
          className
        )}
      >
        {segments.map((segment, idx) => {
          if (segment.kind === "text") {
            return (
              <React.Fragment key={`t-${idx}`}>{segment.text}</React.Fragment>
            );
          }

          const { mark } = segment;
          return (
            <MarkCard
              isActive={activeId === mark.id}
              key={mark.id}
              mark={mark}
              markIndex={marks.findIndex((m) => m.id === mark.id)}
              onAccept={onAccept}
              onDismiss={onDismiss}
              onNavigate={handleNavigate}
              readOnly={readOnly}
              setActiveId={setActiveId}
              text={segment.text}
              markCount={markCount}
            />
          );
        })}
      </div>
    </div>
  );
};
