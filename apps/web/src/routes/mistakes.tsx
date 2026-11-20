import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/mistakes")({
  component: () => <main />,
});
