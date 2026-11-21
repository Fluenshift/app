// The Deploy Profile a server runs in, as `GET /api/deploy-profile` tells the SPA
// (docs/adr/0034): one build serves both profiles, and only the hosted one sends the browser's AI
// key (docs/adr/0012).
import { Schema } from "effect";

export const DeployProfile = Schema.Literals(["local", "hosted"]);
export type DeployProfile = typeof DeployProfile.Type;

/** Body of `GET /api/deploy-profile`. */
export const DeployProfileStatus = Schema.Struct({
  deployProfile: DeployProfile,
});
export type DeployProfileStatus = typeof DeployProfileStatus.Type;
