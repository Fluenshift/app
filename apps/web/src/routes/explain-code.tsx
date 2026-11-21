import { createFileRoute } from "@tanstack/react-router";

import { PageHeader, PageShell } from "../features/academy/page-header";

const ExplainCodePage = () => (
  <PageShell>
    <PageHeader title="Explain code" />
  </PageShell>
);

export const Route = createFileRoute("/explain-code")({
  component: ExplainCodePage,
});
