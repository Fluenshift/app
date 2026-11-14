import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/evaluations/$evaluationId")({
  component: () => <main />,
});
