// Each expected value is the first match of PE's shell-line pattern
// (apps/server/src/evaluation/protected-content.ts at the pin) on its line, as that pattern
// computed it: commands with and without arguments, assignments with quoted, escaped and unquoted
// values, line terminators, which `.` does not match, and lines on which the pattern backs out
// of its first choice of where a value ends (#306).
import { describe, expect, it } from "vitest";

import { readShellLine } from "./shell-line";
import type { ShellLine } from "./shell-line";

const LINES: readonly (readonly [string, ShellLine | undefined])[] = [
  ["", undefined],
  ["ls", { arguments: undefined, command: "ls" }],
  ["ls -la /tmp", { arguments: "-la /tmp", command: "ls" }],
  [" ls", undefined],
  ["ls ", { arguments: "", command: "ls" }],
  ["FOO=bar node app.js", { arguments: "app.js", command: "node" }],
  ['VAR="one two" node app.js', { arguments: "app.js", command: "node" }],
  ["VAR='one two' node app.js", { arguments: "app.js", command: "node" }],
  ["VAR=one\\ two node app.js", { arguments: "app.js", command: "node" }],
  ['A="x\\"y z" cmd', { arguments: undefined, command: "cmd" }],
  ["A='x\\'y z' cmd", { arguments: undefined, command: "cmd" }],
  ["A=1 B_2=2 _C=3 make test", { arguments: "test", command: "make" }],
  ["A=x", { arguments: undefined, command: "A=x" }],
  ["A= cmd", { arguments: "cmd", command: "A=" }],
  ['A="unclosed cmd', { arguments: undefined, command: "cmd" }],
  ['A="x"y cmd', { arguments: undefined, command: "cmd" }],
  ["1A=x cmd", { arguments: "cmd", command: "1A=x" }],
  ['A=""x y" cmd', { arguments: "cmd", command: 'y"' }],
  ["A=''x y' cmd", { arguments: "cmd", command: "y'" }],
  ["A=x\tcmd\targ", { arguments: "arg", command: "cmd" }],
  ["A=a\\\\ b", { arguments: undefined, command: "b" }],
  ["A=a\\\\\\ b c", { arguments: undefined, command: "c" }],
  ["A=\\\\ x y", { arguments: "y", command: "x" }],
  ["A=x\\", { arguments: undefined, command: "A=x\\" }],
  ["A=x\\ ", { arguments: "", command: "A=x\\" }],
  ["cmd a\u2028b", undefined],
  ["cmd\u2028arg", { arguments: "arg", command: "cmd" }],
  ["cmd\u2029\u2029arg", { arguments: "arg", command: "cmd" }],
  ["A=x\\\u2028y cmd", { arguments: "cmd", command: "y" }],
  ['A="x\u2028y" cmd', { arguments: undefined, command: "cmd" }],
  ["A=x\\ y\u2028z\u2028w", { arguments: "w", command: "z" }],
  ["A=x\\ B=y cmd\u2028a b\u2028c", undefined],
  ["A=\u{1F600} cmd", { arguments: undefined, command: "cmd" }],
  ["A=\u00A0x cmd", { arguments: "x cmd", command: "A=" }],
  ["A=\\\\ x\u2028y\u2028z", { arguments: "z", command: "y" }],
  ["A=x\\ y ", { arguments: "", command: "y" }],
  ["A=x\\ B=y\\ z ", { arguments: "", command: "z" }],
  ['A="a b" c\u2028d B=e f', { arguments: "d B=e f", command: "c" }],
  ['_x=\\\\\\ B=\\\\\\ -"', { arguments: undefined, command: '-"' }],
  ['_x=_x=\\\\\\ "\\"', { arguments: undefined, command: '"\\"' }],
  ["_x=A=_x=\\\\ '\"'a b'\" ", { arguments: "b'\" ", command: "'\"'a" }],
  [
    'B=\\\\ "\\"\\\\\\ A= "\\" w\\\\"a b""a b"',
    { arguments: 'A= "\\" w\\\\"a b""a b"', command: '"\\"\\\\\\' },
  ],
];

describe("readShellLine", () => {
  it("reads the command and arguments of each line as PE's pattern matched them", () => {
    expect(LINES.map(([line]) => readShellLine(line))).toEqual(
      LINES.map(([, expected]) => expected)
    );
  });
});
