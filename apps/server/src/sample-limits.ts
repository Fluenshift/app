// The Deploy Profile's caps on one Writing Sample, as the setup status hands them to the web app
// (docs/adr/0006): UTF-8 bytes always, characters only when the profile caps them, and the
// characters of Explain code's snippet likewise (docs/adr/0038).
import type { SampleLimits } from "@grifando/contract";
import type { InputLimits } from "@grifando/env";
import { Option } from "effect";

export const sampleLimitsOf = (limits: InputLimits): SampleLimits => ({
  codeMaxCharacters: Option.getOrNull(limits.codeMaxCharacters),
  sampleMaxBytes: limits.sampleMaxBytes,
  sampleMaxCharacters: Option.getOrNull(limits.sampleMaxCharacters),
});
