// What GET /api/setup answers (FR-24, #273).
import type { SetupStatus } from "@fluenshift/contract";
import type { DeployProfile } from "@fluenshift/env";

import type { trainerSetupOf } from "./trainer-setup";

export const setupStatusOf = (_options: {
  readonly dataLocation: string;
  readonly judge: {
    readonly configured: boolean;
    readonly model: string;
    readonly provider: string;
  };
  readonly profile: DeployProfile;
  readonly trainer: Parameters<typeof trainerSetupOf>[0];
}): SetupStatus => ({
  configured: false,
  dataLocation: "",
  model: "",
  provider: "",
  rubricVersion: "",
});
