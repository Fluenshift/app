import { createFileRoute } from "@tanstack/react-router";

// History arrives with its own unit; the route exists so the primary navigation can link to it.
export const Route = createFileRoute("/evaluations/")({
  component: () => (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">History</h1>
    </main>
  ),
});
