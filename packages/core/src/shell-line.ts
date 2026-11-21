// The command and arguments of a line that may start with a shell command, read as PE's
// apps/server/src/evaluation/protected-content.ts read them at the pin.

/** The pattern's named groups: the command and, when whitespace follows it, its arguments. */
export interface ShellLine {
  readonly arguments: string | undefined;
  readonly command: string;
}

export const readShellLine = (line: string): ShellLine | undefined => {
  const match = line.match(
    /^(?:[A-Za-z_][A-Za-z0-9_]*=(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|(?:\\.|[^\s])+)[\s]+)*(?<command>[^\s]+)(?:\s+(?<arguments>.*))?$/u
  );
  const command = match?.groups?.command;
  return command === undefined
    ? undefined
    : { arguments: match?.groups?.arguments, command };
};
