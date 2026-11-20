import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/write")({
  component: () => <main />,
});
