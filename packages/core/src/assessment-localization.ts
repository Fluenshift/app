// Deterministic localization of a model assessment's spans, ported from PE
// apps/server/src/evaluation/assessment-localization.ts with Uint8Array in place of Buffer.
// A span is re-anchored only when its text occurs exactly once, which is what keeps
// highlights from landing on the wrong occurrence (Grifando #78).
import type {
  AssessmentFinding,
  AssessmentSpan,
  ModelAssessment,
} from "./model-assessment";
import { decodeUtf8, encodeUtf8, isUtf8ByteBoundary } from "./utf8";

const WORD_PATTERN = /\p{L}[\p{L}\p{M}'’\-‑]*/gu;

const utf8ByteLength = (text: string) => encodeUtf8(text).byteLength;

const bytesMatchAt = (source: Uint8Array, target: Uint8Array, index: number) =>
  target.every((byte, offset) => source[index + offset] === byte);

// Byte-sequence search, as Buffer#indexOf does for a buffer argument; Uint8Array#indexOf
// only finds a single byte.
const indexOfBytes = (
  source: Uint8Array,
  target: Uint8Array,
  fromIndex = 0
) => {
  for (
    let index = fromIndex;
    index + target.byteLength <= source.byteLength;
    index += 1
  ) {
    if (bytesMatchAt(source, target, index)) {
      return index;
    }
  }
  return -1;
};

const spanMatchesSource = (source: Uint8Array, span: AssessmentSpan) =>
  span.byteStart >= 0 &&
  span.byteEnd > span.byteStart &&
  span.byteEnd <= source.byteLength &&
  isUtf8ByteBoundary(source, span.byteStart) &&
  isUtf8ByteBoundary(source, span.byteEnd) &&
  decodeUtf8(source.subarray(span.byteStart, span.byteEnd)) ===
    span.originalText;

const uniqueOccurrence = (source: Uint8Array, originalText: string) => {
  const target = encodeUtf8(originalText);
  const first = indexOfBytes(source, target);
  if (
    target.byteLength === 0 ||
    first === -1 ||
    indexOfBytes(source, target, first + 1) !== -1
  ) {
    return;
  }
  return { byteEnd: first + target.byteLength, byteStart: first };
};

const reanchorUniqueSpan = <Span extends AssessmentSpan>(
  source: Uint8Array,
  span: Span
): Span => {
  if (spanMatchesSource(source, span)) {
    return span;
  }
  const occurrence = uniqueOccurrence(source, span.originalText);
  return occurrence === undefined ? span : { ...span, ...occurrence };
};

const coalesceAdjacentDuplicate = (
  source: Uint8Array,
  finding: AssessmentFinding
) => {
  if (
    finding.category !== "Other" ||
    finding.correction !== "" ||
    !/^\p{L}[\p{L}\p{M}]*$/u.test(finding.originalText)
  ) {
    return;
  }
  const repeatedText = `${finding.originalText} ${finding.originalText}`;
  const occurrence = uniqueOccurrence(source, repeatedText);
  if (occurrence === undefined) {
    return;
  }
  const before = decodeUtf8(source.subarray(0, occurrence.byteStart));
  const after = decodeUtf8(source.subarray(occurrence.byteEnd));
  if (
    /[\p{L}\p{M}\p{N}_'’\-‑]$/u.test(before) ||
    /^[\p{L}\p{M}\p{N}_'’\-‑]/u.test(after)
  ) {
    return;
  }
  if (
    spanMatchesSource(source, finding) &&
    (finding.byteStart < occurrence.byteStart ||
      finding.byteEnd > occurrence.byteEnd)
  ) {
    return;
  }
  const text = decodeUtf8(source);
  const completeOccurrences = [...text.matchAll(WORD_PATTERN)].filter(
    (word) => word[0] === finding.originalText
  );
  const [firstWord, secondWord] = completeOccurrences;
  if (
    completeOccurrences.length !== 2 ||
    firstWord === undefined ||
    secondWord === undefined ||
    utf8ByteLength(text.slice(0, firstWord.index)) !== occurrence.byteStart ||
    utf8ByteLength(text.slice(0, secondWord.index)) !==
      occurrence.byteStart + utf8ByteLength(`${finding.originalText} `)
  ) {
    return;
  }
  return {
    ...finding,
    ...occurrence,
    correction: finding.originalText,
    originalText: repeatedText,
  };
};

const expandPartialWords = (
  source: Uint8Array,
  finding: AssessmentFinding
): AssessmentFinding => {
  const text = decodeUtf8(source);
  const originalStart = decodeUtf8(
    source.subarray(0, finding.byteStart)
  ).length;
  const originalEnd = decodeUtf8(source.subarray(0, finding.byteEnd)).length;
  let start = originalStart;
  let end = originalEnd;
  for (const word of text.matchAll(WORD_PATTERN)) {
    const wordEnd = word.index + word[0].length;
    if (word.index < originalStart && originalStart < wordEnd) {
      start = word.index;
    }
    if (word.index < originalEnd && originalEnd < wordEnd) {
      end = wordEnd;
    }
  }
  return {
    ...finding,
    byteEnd: utf8ByteLength(text.slice(0, end)),
    byteStart: utf8ByteLength(text.slice(0, start)),
    correction:
      text.slice(start, originalStart) +
      finding.correction +
      text.slice(originalEnd, end),
    originalText: text.slice(start, end),
  };
};

const commonPrefix = (left: string, right: string) => {
  let length = 0;
  while (length < left.length && left[length] === right[length]) {
    length += 1;
  }
  return left.slice(0, length);
};

const commonSuffix = (left: string, right: string) => {
  let length = 0;
  while (
    length < left.length &&
    length < right.length &&
    left[left.length - length - 1] === right[right.length - length - 1]
  ) {
    length += 1;
  }
  return length === 0 ? "" : left.slice(-length);
};

const trimUnchangedWordContext = (
  finding: AssessmentFinding
): AssessmentFinding => {
  const prefix =
    commonPrefix(finding.originalText, finding.correction).match(
      /^.*\s/su
    )?.[0] ?? "";
  const originalAfterPrefix = finding.originalText.slice(prefix.length);
  const correctionAfterPrefix = finding.correction.slice(prefix.length);
  const suffix =
    commonSuffix(originalAfterPrefix, correctionAfterPrefix).match(
      /\s.*$/su
    )?.[0] ?? "";
  const originalText = originalAfterPrefix.slice(
    0,
    originalAfterPrefix.length - suffix.length
  );
  if (originalText.length === 0) {
    return finding;
  }
  return {
    ...finding,
    byteEnd: finding.byteEnd - utf8ByteLength(suffix),
    byteStart: finding.byteStart + utf8ByteLength(prefix),
    correction: correctionAfterPrefix.slice(
      0,
      correctionAfterPrefix.length - suffix.length
    ),
    originalText,
  };
};

const localizeFinding = (source: Uint8Array, finding: AssessmentFinding) => {
  const anchored =
    coalesceAdjacentDuplicate(source, finding) ??
    reanchorUniqueSpan(source, finding);
  if (
    !spanMatchesSource(source, anchored) ||
    anchored.correction === anchored.originalText
  ) {
    return anchored;
  }
  return trimUnchangedWordContext(expandPartialWords(source, anchored));
};

/** Localize source bytes without changing model-authored linguistic judgments. */
export const localizeModelAssessment = (
  writingSample: string,
  assessment: ModelAssessment
): ModelAssessment => {
  const source = encodeUtf8(writingSample);
  return {
    ...assessment,
    findings: assessment.findings.map((finding) =>
      localizeFinding(source, finding)
    ),
    nonEnglishSpans: assessment.nonEnglishSpans.map((span) =>
      reanchorUniqueSpan(source, span)
    ),
    suggestions: assessment.suggestions.map((span) =>
      reanchorUniqueSpan(source, span)
    ),
  };
};
