import { createRouter } from "@tanstack/react-router";
import type { RouterHistory } from "@tanstack/react-router";

import type { EvaluationClient } from "./features/evaluations/evaluation-client";
import { routeTree } from "./routeTree.gen";

interface CreateAppRouterOptions {
  readonly evaluationClient: EvaluationClient;
  readonly history?: RouterHistory;
}

export const createAppRouter = ({ history }: CreateAppRouterOptions) =>
  createRouter({
    routeTree,
    ...(history === undefined ? {} : { history }),
  });

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
