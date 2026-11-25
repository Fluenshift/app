import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

/** Every scratch directory of the smoke starts with this prefix. */
export const SCRATCH_PREFIX = path.join(tmpdir(), "grifando-docker-smoke-");

export const createScratch = () => mkdtemp(SCRATCH_PREFIX);

/** Removes a scratch directory of the smoke, and refuses any other path. */
export const removeScratch = (directory: string): Promise<void> => {
  const resolved = path.resolve(directory);
  if (!resolved.startsWith(path.resolve(SCRATCH_PREFIX))) {
    return Promise.reject(new Error("refusing to remove an unexpected path"));
  }
  return rm(resolved, { force: true, recursive: true });
};
