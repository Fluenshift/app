// The Deploy Profile's caps on one Writing Sample, as the setup status hands them to the web app
// (docs/adr/0006): UTF-8 bytes always, characters only when the profile caps them.
import type { SampleLimits } from "@fluenshift/contract";
import type { InputLimits } from "@fluenshift/env";

export const sampleLimitsOf = (_limits: InputLimits): SampleLimits => ({
  sampleMaxBytes: 0,
  sampleMaxCharacters: null,
});
