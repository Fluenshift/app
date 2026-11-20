// The application shell: the primary navigation above the current screen. Ported from PE
// apps/web/src/routes/__root.tsx (5e831bb).
import { Toaster } from "@fluenshift/ui/components/sonner";
import { Outlet, createRootRouteWithContext } from "@tanstack/react-router";

import Header from "../components/header";
import type { AcademyClient } from "../features/academy/academy-client";
import type { EvaluationClient } from "../features/evaluations/evaluation-client";

export interface RouterAppContext {
  readonly academyClient: AcademyClient;
  readonly evaluationClient: EvaluationClient;
}

const RootComponent = () => (
  <>
    <div className="grid min-h-svh grid-rows-[auto_1fr]">
      <Header />
      <Outlet />
    </div>
    <Toaster richColors theme="light" />
  </>
);

export const Route = createRootRouteWithContext<RouterAppContext>()({
  component: RootComponent,
});
