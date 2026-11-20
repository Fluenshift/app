// Today's session: one short piece of writing on today's challenge, then a review. Ported from
// Grifando src/app/today/page.tsx (74dbb9f); the challenge comes from the server
// (docs/adr/0025).
import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { PageHeader, PageShell } from "../features/academy/page-header";
import { sampleLimitsFor } from "../features/academy/sample-limits";
import { TodaySession } from "../features/academy/today-session";

const routeApi = getRouteApi("/today");

const TodayPage = () => {
  const challenge = routeApi.useLoaderData();
  const { sampleLimits } = routeApi.useRouteContext();

  return (
    <PageShell>
      <PageHeader
        description="One short piece of writing, then a review mixing today’s mistakes with the ones you’re starting to forget."
        title="Today"
      />
      <TodaySession challenge={challenge} sampleLimits={sampleLimits} />
    </PageShell>
  );
};

export const Route = createFileRoute("/today")({
  beforeLoad: ({ context }) => sampleLimitsFor(context.academyClient),
  loader: ({ context }) => context.academyClient.getDailyChallenge(),
  component: TodayPage,
  preloadStaleTime: 0,
});
