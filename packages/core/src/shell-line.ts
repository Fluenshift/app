// The command and arguments of a line that may start with a shell command, read in linear time.
//
// PE's apps/server/src/evaluation/protected-content.ts read them, at the pin, with this pattern:
//
//   ^(?:[A-Za-z_][A-Za-z0-9_]*=(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|(?:\\.|[^\s])+)[\s]+)*
//   (?<command>[^\s]+)(?:\s+(?<arguments>.*))?$
//
// Its backtracking took exponential time on crafted lines of a few dozen characters (#306): an
// unquoted value reads a backslash either alone or as the start of an escape, and the loop of
// assignments can end a value at several escaped spaces, so a line whose end never matches
// retries every split. readShellLine answers the pattern's first match, in the order in which the
// pattern tries its choices, but decides each position once, from the end of the line backwards.
//
// What the pattern accepts, from a position:
// - A command starts at a character that is not whitespace and runs to the next whitespace. The
//   line ends there, or whitespace follows and the arguments run to the end of the line, which
//   they reach only when they hold no line terminator: `.` matches none, and `\s` matches all.
// - Assignments may come before the command: a name, `=`, a value, then whitespace. The pattern
//   reads as many as it can: when the rest of the line fails after an assignment, it tries the
//   assignment's next possible end, and when none is left, it reads the command at the
//   assignment's start.
// - A value is double-quoted, single-quoted or unquoted, tried in that order. A quoted value ends
//   at its one closing quote. An unquoted value may end at several whitespace characters: the
//   pattern tries a backslash as the start of an escape before it tries it alone, which orders
//   those ends as `unquotedEnd` below finds them.

/** The pattern's named groups: the command and, when whitespace follows it, its arguments. */
export interface ShellLine {
  readonly arguments: string | undefined;
  readonly command: string;
}

const NONE = -1;
const WHITESPACE = /\s/u;
const NAME_START = /[A-Za-z_]/u;
const NAME_CHARACTER = /[A-Za-z0-9_]/u;

// The line terminators, which `.` does not match.
const isLineTerminator = (code: number | undefined): boolean =>
  code === 0x0a || code === 0x0d || code === 0x20_28 || code === 0x20_29;

const valueAt = (table: Int32Array, index: number): number =>
  table[index] ?? NONE;

export const readShellLine = (line: string): ShellLine | undefined => {
  const { length } = line;
  const isWhitespace = (index: number): boolean =>
    index < length && WHITESPACE.test(line.charAt(index));
  // A backslash at `index` can start an escape, `\\.`, unless a line terminator or the end
  // follows it.
  const escapes = (index: number): boolean =>
    index + 1 < length && !isLineTerminator(line.codePointAt(index + 1));

  // The runs that start at each position, and the closing quote of a quoted value whose text
  // starts there.
  const whitespaceEnd = new Int32Array(length + 2).fill(length);
  const wordEnd = new Int32Array(length + 2).fill(length);
  const nameEnd = new Int32Array(length + 2).fill(length);
  const doubleQuoteClose = new Int32Array(length + 2).fill(NONE);
  const singleQuoteClose = new Int32Array(length + 2).fill(NONE);
  let lastLineTerminator = NONE;
  const closingQuote = (table: Int32Array, quote: string, index: number) => {
    const character = line.charAt(index);
    if (character === quote) {
      return index;
    }
    if (character === "\\") {
      return escapes(index) ? valueAt(table, index + 2) : NONE;
    }
    return valueAt(table, index + 1);
  };
  for (let index = length - 1; index >= 0; index -= 1) {
    const blank = isWhitespace(index);
    whitespaceEnd[index] = blank ? valueAt(whitespaceEnd, index + 1) : index;
    wordEnd[index] = blank ? index : valueAt(wordEnd, index + 1);
    nameEnd[index] = NAME_CHARACTER.test(line.charAt(index))
      ? valueAt(nameEnd, index + 1)
      : index;
    doubleQuoteClose[index] = closingQuote(doubleQuoteClose, '"', index);
    singleQuoteClose[index] = closingQuote(singleQuoteClose, "'", index);
    if (
      lastLineTerminator === NONE &&
      isLineTerminator(line.codePointAt(index))
    ) {
      lastLineTerminator = index;
    }
  }

  // `commandStart[index]`: where the command starts when assignments may start at `index`, or
  // NONE when the rest of the line does not match from there. `unquotedEnd[index]`: the first
  // end, in the pattern's order, of an unquoted value read up to `index`, at which the rest of
  // the line matches, or NONE.
  const commandStart = new Int32Array(length + 2).fill(NONE);
  const unquotedEnd = new Int32Array(length + 2).fill(NONE);
  // After a value that ends at `end`, whitespace, then the assignments that follow it.
  const afterValue = (end: number) =>
    isWhitespace(end)
      ? valueAt(commandStart, valueAt(whitespaceEnd, end))
      : NONE;
  const quotedValueClose = (start: number) => {
    const quote = line.charAt(start);
    if (quote === '"') {
      return valueAt(doubleQuoteClose, start + 1);
    }
    if (quote === "'") {
      return valueAt(singleQuoteClose, start + 1);
    }
    return NONE;
  };
  const afterAssignment = (start: number) => {
    const equals = valueAt(nameEnd, start);
    if (!NAME_START.test(line.charAt(start)) || line.charAt(equals) !== "=") {
      return NONE;
    }
    const value = equals + 1;
    const close = quotedValueClose(value);
    const afterQuoted = close === NONE ? NONE : afterValue(close + 1);
    if (afterQuoted !== NONE || value >= length || isWhitespace(value)) {
      return afterQuoted;
    }
    const end = valueAt(unquotedEnd, value);
    return end === NONE ? NONE : afterValue(end);
  };
  const commandAt = (start: number) => {
    const end = valueAt(wordEnd, start);
    return (
      start < length &&
      !isWhitespace(start) &&
      (end === length || lastLineTerminator < valueAt(whitespaceEnd, end))
    );
  };
  for (let index = length - 1; index >= 0; index -= 1) {
    if (isWhitespace(index)) {
      unquotedEnd[index] = afterValue(index) === NONE ? NONE : index;
    } else if (line.charAt(index) === "\\" && escapes(index)) {
      const escaped = valueAt(unquotedEnd, index + 2);
      unquotedEnd[index] =
        escaped === NONE ? valueAt(unquotedEnd, index + 1) : escaped;
    } else {
      unquotedEnd[index] = valueAt(unquotedEnd, index + 1);
    }
    const assigned = afterAssignment(index);
    if (assigned !== NONE) {
      commandStart[index] = assigned;
    } else if (commandAt(index)) {
      commandStart[index] = index;
    }
  }

  const start = valueAt(commandStart, 0);
  if (start === NONE) {
    return undefined;
  }
  const end = valueAt(wordEnd, start);
  return {
    arguments:
      end === length ? undefined : line.slice(valueAt(whitespaceEnd, end)),
    command: line.slice(start, end),
  };
};
