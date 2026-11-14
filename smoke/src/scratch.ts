// Typed stub for the red commit: it removes nothing and refuses nothing.
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export const SCRATCH_PREFIX = path.join(tmpdir(), "fluenshift-docker-smoke-");

export const createScratch = () => mkdtemp(SCRATCH_PREFIX);

export const removeScratch = (_directory: string): Promise<void> =>
  Promise.resolve();
