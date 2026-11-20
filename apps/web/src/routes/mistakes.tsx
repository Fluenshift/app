// The Mistake Notebook. Ported from Grifando src/app/mistakes/page.tsx (74dbb9f): the notebook
// comes from the server, and the page applies `window` and `origin` from its own URL
// (docs/adr/0025).
import { Badge } from "@fluenshift/ui/components/badge";
import { buttonVariants } from "@fluenshift/ui/components/button";
import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";

import { MISTAKE_CATEGORY_LABELS } from "../features/academy/mistake-category-labels";
import { PageHeader, PageShell } from "../features/academy/page-header";

interface MistakesSearch {
  readonly origin?: "pt";
  readonly window?: "30d";
}

const MASTERY_LABELS = {
  ACTIVE: "Active",
  IMPROVING: "Improving",
  MASTERED: "Mastered",
} as const;

const routeApi = getRouteApi("/mistakes");

// The search of a /mistakes link, keeping the other filter when one is toggled.
const mistakesSearch = (filters: {
  readonly fromPortuguese: boolean;
  readonly last30Days: boolean;
}): MistakesSearch => ({
  ...(filters.last30Days ? { window: "30d" } : {}),
  ...(filters.fromPortuguese ? { origin: "pt" } : {}),
});

// Tab-style filter link: the 2px ink underline marks the active option.
const FilterTab = ({
  active,
  children,
  search,
}: {
  readonly active: boolean;
  readonly children: string;
  readonly search: MistakesSearch;
}) => (
  <Link
    aria-current={active ? "page" : undefined}
    className={`border-b-2 pb-2 text-sm ${active ? "border-foreground text-foreground" : "text-muted-foreground hover:text-foreground border-transparent"}`}
    search={search}
    to="/mistakes"
  >
    {children}
  </Link>
);

const MistakesPage = () => {
  const notebook = routeApi.useLoaderData();
  const search = routeApi.useSearch();
  const isLast30Days = search.window === "30d";
  const isFromPortuguese = search.origin === "pt";
  const patternList = isFromPortuguese
    ? notebook.patterns.filter((pattern) => pattern.fromPortuguese)
    : notebook.patterns;
  const breakdown = isLast30Days
    ? notebook.breakdown.last30Days
    : notebook.breakdown.allTime;
  const dueCount = patternList.filter((pattern) => pattern.due).length;

  return (
    <PageShell>
      <PageHeader
        description="Patterns from your writing. The same underlying mistake, however many times you make it, shows up here once."
        title="Mistake notebook"
      />

      {dueCount > 0 ? (
        <section className="rounded-card bg-linen mb-16 flex flex-wrap items-center justify-between gap-6 px-6 py-8 md:px-10">
          <p className="text-heading-sm">
            {dueCount} pattern{dueCount === 1 ? " is" : "s are"} due for review.
          </p>
          {/* Practice sets are built from the most-forgotten patterns first
              (selectPatternsForPractice), so generating one there reviews these. */}
          <Link className={buttonVariants()} to="/exercises">
            Practice due patterns
          </Link>
        </section>
      ) : null}

      <div className="grid gap-x-16 gap-y-16 lg:grid-cols-[360px_minmax(0,1fr)]">
        <section aria-labelledby="common-title">
          <h2 className="text-heading mb-6" id="common-title">
            Most common
          </h2>
          <nav aria-label="Time range" className="mb-6 flex gap-6">
            <FilterTab
              active={!isLast30Days}
              search={mistakesSearch({
                fromPortuguese: isFromPortuguese,
                last30Days: false,
              })}
            >
              All time
            </FilterTab>
            <FilterTab
              active={isLast30Days}
              search={mistakesSearch({
                fromPortuguese: isFromPortuguese,
                last30Days: true,
              })}
            >
              Last 30 days
            </FilterTab>
          </nav>
          {breakdown.length === 0 ? (
            <p className="text-muted-foreground">
              No mistakes recorded{" "}
              {isLast30Days ? "in the last 30 days" : "yet"}.
            </p>
          ) : (
            <ul className="border-border border-t">
              {breakdown.map((entry) => (
                <li
                  className="border-border space-y-3 border-b py-4"
                  key={entry.category}
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <span>{MISTAKE_CATEGORY_LABELS[entry.category]}</span>
                    <span className="text-muted-foreground text-sm tabular-nums">
                      {entry.percentage}%
                    </span>
                  </div>
                  <div aria-hidden="true" className="bg-stone/60 h-1 w-full">
                    <div
                      className="bg-foreground h-full"
                      style={{ width: `${entry.percentage}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="patterns-title">
          <div className="mb-6 flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="text-heading" id="patterns-title">
              Patterns
            </h2>
            <span className="label-mono text-muted-foreground">
              {patternList.length}{" "}
              {patternList.length === 1 ? "pattern" : "patterns"}
            </span>
          </div>
          <nav aria-label="Origin" className="mb-6 flex gap-6">
            <FilterTab
              active={!isFromPortuguese}
              search={mistakesSearch({
                fromPortuguese: false,
                last30Days: isLast30Days,
              })}
            >
              All patterns
            </FilterTab>
            <FilterTab
              active={isFromPortuguese}
              search={mistakesSearch({
                fromPortuguese: true,
                last30Days: isLast30Days,
              })}
            >
              From Portuguese
            </FilterTab>
          </nav>
          {patternList.length === 0 && isFromPortuguese ? (
            <p className="prose-serif text-iron text-lg">
              No mistakes flagged as coming from Portuguese yet.
            </p>
          ) : null}
          {patternList.length === 0 && !isFromPortuguese ? (
            <p className="prose-serif text-iron text-lg">
              No mistakes yet.{" "}
              <Link className="underline" to="/write">
                Write something
              </Link>{" "}
              to get started.
            </p>
          ) : null}
          {patternList.length === 0 ? null : (
            <ul className="border-border border-t">
              {patternList.map((pattern) => (
                <li
                  className="border-border space-y-3 border-b py-5"
                  key={pattern.id}
                >
                  <p className="prose-serif text-xl leading-snug">
                    <span className="text-muted-foreground line-through decoration-1">
                      {pattern.exampleOriginal}
                    </span>{" "}
                    <span aria-hidden="true">→</span>{" "}
                    <span className="sr-only">corrected to</span>
                    <span>{pattern.exampleCorrection}</span>
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline">
                      {MISTAKE_CATEGORY_LABELS[pattern.category]}
                    </Badge>
                    {pattern.fading ? (
                      <Badge variant="destructive">Fading</Badge>
                    ) : (
                      <Badge
                        variant={
                          pattern.masteryLevel === "MASTERED"
                            ? "success"
                            : "secondary"
                        }
                      >
                        {MASTERY_LABELS[pattern.masteryLevel]}
                      </Badge>
                    )}
                    <span className="text-muted-foreground ml-1 text-sm">
                      {pattern.occurrenceCount}× · last seen{" "}
                      {new Date(pattern.lastSeenAt).toLocaleDateString()}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageShell>
  );
};

export const Route = createFileRoute("/mistakes")({
  validateSearch: (search: Record<string, unknown>): MistakesSearch => ({
    ...(search["window"] === "30d" ? { window: "30d" } : {}),
    ...(search["origin"] === "pt" ? { origin: "pt" } : {}),
  }),
  loader: ({ context }) => context.academyClient.getMistakeNotebook(),
  component: MistakesPage,
  preloadStaleTime: 0,
});
