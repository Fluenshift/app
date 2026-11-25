import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createScratch, removeScratch, SCRATCH_PREFIX } from "./scratch";

// What removing a directory came to: removed, or the message of the refusal.
const removal = async (directory: string) => {
  try {
    await removeScratch(directory);
    return "removed";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

describe("scratch directory", () => {
  it("refuses to remove a path outside its own prefix", async () => {
    const outside = await mkdtemp(path.join(tmpdir(), "grifando-outside-"));
    const escaping = path.join(
      `${SCRATCH_PREFIX}run`,
      "..",
      path.basename(outside)
    );
    const outcomes = [await removal(outside), await removal(escaping)];
    const kept = existsSync(outside);
    await rm(outside, { force: true, recursive: true });

    expect(outcomes).toStrictEqual([
      "refusing to remove an unexpected path",
      "refusing to remove an unexpected path",
    ]);
    expect(kept).toBe(true);
  });

  it("removes a scratch directory of its own with everything in it", async () => {
    const scratch = await createScratch();
    await mkdtemp(path.join(scratch, "data-"));

    await removeScratch(scratch);

    expect(existsSync(scratch)).toBe(false);
    await rm(scratch, { force: true, recursive: true });
  });
});
