// The application router. Its context carries the Evaluation client and the Academy client, so
// the app runs on the HTTP clients and the screen tests on the in-memory ones. Ported from PE
// apps/web/src/router.ts (5e831bb); the Academy client is docs/adr/0025's.
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
  readonly evaluationClient: EvaluationClient;
  readonly history?: RouterHistory;
}

export const createAppRouter = ({
  academyClient = unavailableAcademyClient,
  evaluationClient,
  history,
}: CreateAppRouterOptions) =>
  createRouter({
    context: { academyClient, evaluationClient },
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
