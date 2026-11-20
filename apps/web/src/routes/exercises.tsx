// The Learner's practice set. Ported from Grifando src/app/exercises/page.tsx (74dbb9f).
import { createFileRoute } from "@tanstack/react-router";

import { ExercisePractice } from "../features/academy/exercise-practice";
import { PageHeader, PageShell } from "../features/academy/page-header";

const ExercisesPage = () => (
  <PageShell>
    <PageHeader
      description="Built from your own mistakes. Answer before you see the solution — recall is what makes it stick."
      title="Exercises"
    />
    <ExercisePractice />
  </PageShell>
);

export const Route = createFileRoute("/exercises")({
  component: ExercisesPage,
});
