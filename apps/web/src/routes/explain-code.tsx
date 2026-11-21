// The Academy's Explain code page. Ported from Grifando src/app/explain-code/page.tsx (74dbb9f);
// it reads the Deploy Profile's caps before it loads, as /write does (docs/adr/0006).
import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { ExplainCodeCoach } from "../features/academy/explain-code-coach";
import { PageHeader, PageShell } from "../features/academy/page-header";
import { sampleLimitsFor } from "../features/academy/sample-limits";

const routeApi = getRouteApi("/explain-code");

const ExplainCodePage = () => {
  const { sampleLimits } = routeApi.useRouteContext();

  return (
    <PageShell>
      <PageHeader
        description="Paste a small snippet and explain what it does in English — the way you would in a code review."
        title="Explain code"
      />
      <ExplainCodeCoach sampleLimits={sampleLimits} />
    </PageShell>
  );
};

export const Route = createFileRoute("/explain-code")({
  beforeLoad: ({ context }) => sampleLimitsFor(context.academyClient),
  component: ExplainCodePage,
});
