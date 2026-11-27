// The application router. Its context carries the Evaluation client and the Academy client, so
// the app runs on the HTTP clients and the screen tests on the in-memory ones, and the Deploy
// Profile the server named. Ported from PE apps/web/src/router.ts (5e831bb); the Academy client is
// docs/adr/0025's, the Deploy Profile docs/adr/0034's.
import type { DeployProfile } from "@grifando/contract";
import { createRouter } from "@tanstack/react-router";
import type { RouterHistory } from "@tanstack/react-router";

import Loader from "./components/loader";
import { unavailableAcademyClient } from "./features/academy/academy-client";
import type { AcademyClient } from "./features/academy/academy-client";
import type { EvaluationClient } from "./features/evaluations/evaluation-client";
import { routeTree } from "./routeTree.gen";

interface CreateAppRouterOptions {
  /** The Evaluation screens' tests build the router without one (`unavailableAcademyClient`). */
  readonly academyClient?: AcademyClient;
  /** The local profile when left out, as the screen tests mostly run. */
  readonly deployProfile?: DeployProfile;
  readonly evaluationClient: EvaluationClient;
  readonly history?: RouterHistory;
}

export const createAppRouter = ({
  academyClient = unavailableAcademyClient,
  deployProfile = "local",
  evaluationClient,
  history,
}: CreateAppRouterOptions) =>
  createRouter({
    context: { academyClient, deployProfile, evaluationClient },
    defaultPendingComponent: Loader,
    defaultPreload: "intent",
    routeTree,
    scrollRestoration: true,
    ...(history === undefined ? {} : { history }),
  });

export type AppRouter = ReturnType<typeof createAppRouter>;

declare module "@tanstack/react-router" {
  interface Register {
    router: AppRouter;
  }
}
