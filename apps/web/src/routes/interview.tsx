// A mock technical interview in English. Ported from Grifando src/app/interview/page.tsx
// (74dbb9f); the feedback on how the Learner said it is each answer's Evaluation
// (docs/adr/0010).
import { createFileRoute } from "@tanstack/react-router";

import { InterviewPractice } from "../features/academy/interview-practice";
import { PageHeader, PageShell } from "../features/academy/page-header";

const InterviewPage = () => (
  <PageShell>
    <PageHeader
      description="A mock technical interview: answer each question in English and get feedback on how you said it."
      title="Interview"
    />
    <InterviewPractice />
  </PageShell>
);

export const Route = createFileRoute("/interview")({
  component: InterviewPage,
});
