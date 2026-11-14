// Ported from Grifando src/lib/answerDiff.ts.

export interface DiffSegment {
  text: string;
  kind: "same" | "removed" | "added";
}

const tokenize = (value: string): string[] =>
  value.trim().split(/\s+/u).filter(Boolean);

// Words compare case- and punctuation-insensitively, the same leniency the
// grader applies to whole answers ("Done." vs "done").
const wordKey = (word: string): string =>
  word.toLowerCase().replaceAll(/[.,!?;:"]/gu, "");

// Every index below stays inside the table and the word lists, so a read never misses; the
// fallbacks only satisfy the strict index checks.
const cell = (table: number[][], i: number, j: number): number =>
  table[i]?.[j] ?? 0;
const word = (words: string[], index: number): string => words[index] ?? "";

// Longest-common-subsequence table over word keys; both the edit distance and
// the diff walk read from it.
const lcsTable = (a: string[], b: string[]): number[][] => {
  const table = Array.from({ length: a.length + 1 }, () =>
    Array.from({ length: b.length + 1 }, () => 0)
  );
  for (let i = a.length - 1; i >= 0; i -= 1) {
    const row = table[i] ?? [];
    for (let j = b.length - 1; j >= 0; j -= 1) {
      row[j] =
        wordKey(word(a, i)) === wordKey(word(b, j))
          ? cell(table, i + 1, j + 1) + 1
          : Math.max(cell(table, i + 1, j), cell(table, i, j + 1));
    }
  }
  return table;
};

const wordDistance = (a: string[], b: string[]): number =>
  a.length + b.length - 2 * cell(lcsTable(a, b), 0, 0);

// Picks the acceptable answer needing the fewest word insertions/deletions to
// reach from the user's answer, so a near-miss is compared against the version
// it was actually close to.
// Ties keep the generator's order.
export const findClosestAnswer = (
  userAnswer: string,
  acceptableAnswers: string[]
): string | null => {
  const userWords = tokenize(userAnswer);
  let best: { answer: string; distance: number } | null = null;
  for (const answer of acceptableAnswers) {
    const distance = wordDistance(userWords, tokenize(answer));
    if (!best || distance < best.distance) {
      best = { answer, distance };
    }
  }
  return best?.answer ?? null;
};

// Word-level diff from the user's answer to the expected one: "removed" words
// were in the user's answer but not expected, "added" words were missing.
// Adjacent words of the same kind are merged into one segment.
export const diffWords = (
  userAnswer: string,
  expected: string
): DiffSegment[] => {
  const a = tokenize(userAnswer);
  const b = tokenize(expected);
  const table = lcsTable(a, b);
  const segments: DiffSegment[] = [];

  const push = (kind: DiffSegment["kind"], text: string) => {
    const last = segments.at(-1);
    if (last?.kind === kind) {
      last.text += ` ${text}`;
    } else {
      segments.push({ kind, text });
    }
  };

  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (wordKey(word(a, i)) === wordKey(word(b, j))) {
      push("same", word(b, j));
      i += 1;
      j += 1;
    } else if (cell(table, i + 1, j) >= cell(table, i, j + 1)) {
      push("removed", word(a, i));
      i += 1;
    } else {
      push("added", word(b, j));
      j += 1;
    }
  }
  while (i < a.length) {
    push("removed", word(a, i));
    i += 1;
  }
  while (j < b.length) {
    push("added", word(b, j));
    j += 1;
  }
  return segments;
};
