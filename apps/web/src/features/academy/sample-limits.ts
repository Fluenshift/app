// The Deploy Profile's caps on one Writing Sample, read before an Academy screen with a writing
// sheet loads (docs/adr/0006). They join the route's context, so the screen's loader data stays
// its own.
import type { SampleLimits } from "@grifando/contract";

import type { AcademyClient } from "./academy-client";

export const sampleLimitsFor = async (
  academyClient: AcademyClient
): Promise<{ readonly sampleLimits: SampleLimits }> => {
  const sampleLimits = await academyClient.getSampleLimits();
  return { sampleLimits };
};
