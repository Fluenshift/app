import { createRouter } from "@tanstack/react-router";
import type { RouterHistory } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";

export const createAppRouter = (
  options: { readonly history?: RouterHistory } = {}
) => createRouter({ routeTree, ...options });

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
