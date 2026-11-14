// The application router. Its context carries the Evaluation client, so the app runs on the
// HTTP client and the screen tests on the in-memory one. Ported from PE apps/web/src/router.ts
// (5e831bb).
import { createRouter } from "@tanstack/react-router";
import type { RouterHistory } from "@tanstack/react-router";

import Loader from "./components/loader";
import type { EvaluationClient } from "./features/evaluations/evaluation-client";
import { routeTree } from "./routeTree.gen";

interface CreateAppRouterOptions {
  readonly evaluationClient: EvaluationClient;
  readonly history?: RouterHistory;
}

export const createAppRouter = ({
  evaluationClient,
  history,
}: CreateAppRouterOptions) =>
  createRouter({
    context: { evaluationClient },
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
