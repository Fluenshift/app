import { createFileRoute } from "@tanstack/react-router";

import { PageHeader, PageShell } from "../features/academy/page-header";

const PrivacyPage = () => (
  <PageShell>
    <PageHeader title="Privacy" />
  </PageShell>
);

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});
