// A mock technical interview in English. Ported from Grifando src/app/interview/page.tsx
// (74dbb9f); the feedback on how the Learner said it is each answer's Evaluation
// (docs/adr/0010).
import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { InterviewPractice } from "../features/academy/interview-practice";
import { PageHeader, PageShell } from "../features/academy/page-header";
import { sampleLimitsFor } from "../features/academy/sample-limits";

const routeApi = getRouteApi("/interview");

const InterviewPage = () => {
  const { sampleLimits } = routeApi.useRouteContext();

  return (
    <PageShell>
      <PageHeader
        description="A mock technical interview: answer each question in English and get feedback on how you said it."
        title="Interview"
      />
      <InterviewPractice sampleLimits={sampleLimits} />
    </PageShell>
  );
};

export const Route = createFileRoute("/interview")({
  beforeLoad: ({ context }) => sampleLimitsFor(context.academyClient),
  component: InterviewPage,
});
