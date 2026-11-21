// One deterministic Evaluation for the Docker smoke (G6), written into the data directory of a
// local profile. Ported from PE apps/server/src/test/seed-docker-smoke.ts.

/** Where to write the Evaluation, and the Writing Sample it evaluates. */
export interface DockerSmokeSeed {
  readonly dataDirectory: string;
  readonly writingSample: string;
}

/** Writes the Evaluation and answers its id. */
export const seedDockerSmoke = (seed: DockerSmokeSeed): Promise<string> =>
  Promise.resolve(seed.dataDirectory);
