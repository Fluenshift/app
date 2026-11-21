// What every gate script shares: the repository root, and the error a script reports as its
// failure (exit 1) rather than as a crash.

import path from "node:path";

export class ScriptError extends Error {
  override name = "ScriptError";
}

export const repoRoot = path.resolve(import.meta.dirname, "..");
