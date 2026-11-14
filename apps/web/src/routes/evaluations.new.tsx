// Ported from PE apps/web/src/routes/evaluations.new.tsx (5e831bb).
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/evaluations/new")({
  beforeLoad: () => {
    throw redirect({ replace: true, to: "/" });
  },
});
