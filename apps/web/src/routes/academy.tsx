// The Academy dashboard. Ported from Grifando src/app/page.tsx (74dbb9f), at /academy: the
// Writing Desk keeps / (docs/adr/0025). The dashboard comes from the server; the landing specimen
// is fixed data.
import { buttonVariants } from "@fluenshift/ui/components/button";
import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";

import {
  FindingTrend,
  ProgressSummary,
  RecentPatterns,
  RecentWriting,
  StreakStatus,
  WeakAreas,
} from "../features/academy/dashboard";
import { HeroNote } from "../features/academy/hero-note";
import { LiveSpecimen } from "../features/academy/live-specimen";
import { MISTAKE_CATEGORY_LABELS } from "../features/academy/mistake-category-labels";
import {
  PageShell,
  Section,
  SectionTitle,
} from "../features/academy/page-header";

const routeApi = getRouteApi("/academy");

const AcademyPage = () => {
  const dashboard = routeApi.useLoaderData();
  const { dueCount, recommendation } = dashboard;
  const { promptText } = dashboard.dailyChallenge;
  const promptIsLong = promptText.length > 110;

  return (
    <PageShell>
      <header className="grid gap-x-16 gap-y-8 pt-12 pb-10 md:pt-20 md:pb-14 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-end">
        <h1 className="text-display-lg rise-in max-w-[14ch]">
          Learn English from the mistakes you actually make.
        </h1>
        <div
          className="rise-in space-y-6 lg:pb-1"
          style={{ animationDelay: "80ms" }}
        >
          <p className="prose-serif text-iron text-lg">
            Write anything. Grifando marks each slip, explains it, and turns it
            into practice built from your own writing.
          </p>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Link className={buttonVariants({ size: "lg" })} to="/write">
                Proof your own writing
              </Link>
              <Link
                className={buttonVariants({ size: "lg", variant: "ghost" })}
                to="/today"
              >
                Today&apos;s session
              </Link>
            </div>
            <HeroNote>your own mistakes, not generic drills</HeroNote>
          </div>
        </div>
      </header>

      <Section className="pb-16 md:pb-24">
        <LiveSpecimen />
      </Section>

      <Section className="pb-16 md:pb-24">
        <div className="grid gap-x-16 gap-y-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end">
          <div className="space-y-5">
            <p className="label-mono text-muted-foreground">
              Today&apos;s challenge
            </p>
            <h2
              className={
                promptIsLong
                  ? "text-heading-lg max-w-[24ch]"
                  : "text-display max-w-[18ch]"
              }
            >
              {promptText}
            </h2>
          </div>
          <div className="space-y-6">
            <StreakStatus streak={dashboard.streak} />
            <div className="flex flex-wrap gap-2">
              <Link
                className={buttonVariants({ variant: "outline" })}
                to="/today"
              >
                Start today&apos;s session
              </Link>
              <Link
                className={buttonVariants({ variant: "ghost" })}
                to="/write"
              >
                Write freely
              </Link>
            </div>
          </div>
        </div>
      </Section>

      <Section tone="linen">
        <SectionTitle>Progress</SectionTitle>
        <div className="space-y-12">
          <ProgressSummary progress={dashboard.progress} />
          <FindingTrend trend={dashboard.findingTrend} />
        </div>
      </Section>

      <div className="grid gap-x-16 gap-y-16 pt-20 md:pt-24 lg:grid-cols-2">
        <section>
          <SectionTitle>Practice next</SectionTitle>
          <div className="space-y-4">
            {dueCount > 0 ? (
              <p className="text-iron">
                {dueCount} pattern{dueCount === 1 ? " is" : "s are"} due for
                review — you&apos;re likely to be forgetting{" "}
                {dueCount === 1 ? "it" : "them"}.
              </p>
            ) : null}
            {recommendation === null ? (
              <p className="prose-serif text-iron text-lg">
                Write something first — exercises are generated from mistakes
                found in your own writing.
              </p>
            ) : (
              <>
                <p className="text-iron">
                  You&apos;ve mixed up{" "}
                  {MISTAKE_CATEGORY_LABELS[recommendation.category]}{" "}
                  {recommendation.occurrenceCount} time
                  {recommendation.occurrenceCount === 1 ? "" : "s"}.
                </p>
                <p className="prose-serif text-2xl leading-snug">
                  <span className="text-muted-foreground line-through decoration-1">
                    {recommendation.exampleOriginal}
                  </span>{" "}
                  <span aria-hidden="true">→</span>{" "}
                  <span className="sr-only">should be</span>
                  <span>{recommendation.exampleCorrection}</span>
                </p>
              </>
            )}
            <div className="pt-2">
              <Link
                className={buttonVariants({ variant: "outline" })}
                to="/exercises"
              >
                Go to exercises
              </Link>
            </div>
          </div>
        </section>

        <section>
          <SectionTitle>Weak areas</SectionTitle>
          <WeakAreas breakdown={dashboard.weakAreas} />
        </section>

        <section>
          <SectionTitle
            aside={
              <Link className="text-sm underline" to="/mistakes">
                All mistakes
              </Link>
            }
          >
            Recent mistakes
          </SectionTitle>
          <RecentPatterns patterns={dashboard.recentPatterns} />
        </section>

        <section>
          <SectionTitle>Recent writing</SectionTitle>
          <RecentWriting writing={dashboard.recentWriting} />
        </section>
      </div>
    </PageShell>
  );
};

export const Route = createFileRoute("/academy")({
  loader: ({ context }) => context.academyClient.getAcademyDashboard(),
  component: AcademyPage,
  preloadStaleTime: 0,
});
