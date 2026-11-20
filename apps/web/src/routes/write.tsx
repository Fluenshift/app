// The Academy's free writing page, which also opens a technical prompt or today's challenge.
// Ported from Grifando src/app/write/page.tsx (74dbb9f): the page reads `promptId` and `mode`
// from its own URL, a technical prompt comes from the bank of packages/core, and the daily
// challenge from the server (docs/adr/0025).
import { findTechnicalPromptById } from "@fluenshift/core/technical-prompts";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";

import { PageHeader, PageShell } from "../features/academy/page-header";
import { WritingCoach } from "../features/academy/writing-coach";
import type { InitialChallenge } from "../features/academy/writing-coach";

interface WriteSearch {
  readonly mode?: "daily";
  readonly promptId?: string;
}

const routeApi = getRouteApi("/write");

const headingFor = (challenge: InitialChallenge | undefined) => {
  if (challenge?.promptType === "DAILY_CHALLENGE") {
    return {
      description:
        "Answer the prompt in your own words. Mistakes you make here feed your review.",
      title: "Today’s challenge",
    };
  }
  if (challenge?.promptType === "TECHNICAL") {
    return {
      description:
        "Explain it the way you would to a teammate — clear beats fancy.",
      title: "Technical English",
    };
  }
  return {
    description:
      "Anything in English: free writing, a GitHub issue, a PR description. Write first; feedback comes after.",
    title: "Write",
  };
};

const WritePage = () => {
  const initialChallenge = routeApi.useLoaderData();
  const heading = headingFor(initialChallenge);

  return (
    <PageShell>
      <PageHeader description={heading.description} title={heading.title} />
      <WritingCoach initialChallenge={initialChallenge} />
    </PageShell>
  );
};

export const Route = createFileRoute("/write")({
  validateSearch: (search: Record<string, unknown>): WriteSearch => ({
    ...(search["mode"] === "daily" ? { mode: "daily" } : {}),
    ...(typeof search["promptId"] === "string"
      ? { promptId: search["promptId"] }
      : {}),
  }),
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }): Promise<InitialChallenge | undefined> => {
    const technicalPrompt =
      deps.promptId === undefined
        ? undefined
        : findTechnicalPromptById(deps.promptId);
    if (technicalPrompt !== undefined) {
      return Promise.resolve({
        promptText: technicalPrompt.text,
        promptType: "TECHNICAL",
        technicalCategory: technicalPrompt.category,
      });
    }
    return deps.mode === "daily"
      ? context.academyClient.getDailyChallenge()
      : Promise.resolve(undefined);
  },
  component: WritePage,
  preloadStaleTime: 0,
});
