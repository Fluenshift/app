// What GET /api/setup answers (FR-24, #273): the Judge's provider and model, where the data lives
// and the current Rubric Version, and in the local profile the Trainer the server holds a key
// for. The hosted profile holds no Trainer key: the visitor brings one (docs/adr/0012).
import type { SetupStatus } from "@grifando/contract";
import { CURRENT_RUBRIC_VERSION } from "@grifando/core/rubric-v1";
import type { DeployProfile } from "@grifando/env";

import { trainerSetupOf } from "./trainer-setup";

export const setupStatusOf = ({
  dataLocation,
  judge,
  profile,
  trainer,
}: {
  readonly dataLocation: string;
  readonly judge: {
    readonly configured: boolean;
    readonly model: string;
    readonly provider: string;
  };
  readonly profile: DeployProfile;
  readonly trainer: Parameters<typeof trainerSetupOf>[0];
}): SetupStatus => ({
  configured: judge.configured,
  dataLocation,
  model: judge.model,
  provider: judge.provider,
  rubricVersion: CURRENT_RUBRIC_VERSION,
  ...(profile === "local" ? { trainer: trainerSetupOf(trainer) } : {}),
});
