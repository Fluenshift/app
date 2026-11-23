// Ported from PE apps/web/src/routes/setup.tsx (5e831bb). It speaks for the local profile, whose
// facts FR-24 lists; in the hosted profile HR-08 replaces FR-24, so it redirects to /privacy
// (docs/adr/0036).
import { createFileRoute, getRouteApi, redirect } from "@tanstack/react-router";

const routeApi = getRouteApi("/setup");

const SetupPage = () => {
  const setup = routeApi.useLoaderData();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        Setup &amp; privacy
      </h1>

      <div className="mt-5 grid overflow-hidden rounded-2xl border md:grid-cols-[minmax(0,2fr)_minmax(18rem,3fr)]">
        <div className="md:border-r">
          <section aria-labelledby="provider-heading" className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold" id="provider-heading">
                Provider
              </h2>
              <p className="text-sm font-semibold">
                {setup.configured ? "Ready" : "Needs setup"}
              </p>
            </div>
            <p className="text-muted-foreground mt-2 text-sm">
              {setup.provider} · {setup.model}
            </p>
            {!setup.configured && (
              <p className="text-muted-foreground mt-4 text-xs leading-5">
                Set <code>OPENROUTER_API_KEY</code> in the server environment,
                then restart.
              </p>
            )}
          </section>
          {setup.trainer !== undefined && (
            <section aria-labelledby="trainer-heading" className="border-t p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-sm font-semibold" id="trainer-heading">
                  Trainer
                </h2>
                <p className="text-sm font-semibold">
                  {setup.trainer.configured ? "Ready" : "Needs setup"}
                </p>
              </div>
              {setup.trainer.configured ? (
                <p className="text-muted-foreground mt-2 text-sm">
                  {setup.trainer.provider} · {setup.trainer.model}
                </p>
              ) : (
                <p className="text-muted-foreground mt-4 text-xs leading-5">
                  Set <code>ANTHROPIC_API_KEY</code>, or{" "}
                  <code>GEMINI_API_KEY</code> with{" "}
                  <code>AI_PROVIDER=gemini</code>, in the server environment,
                  then restart.
                </p>
              )}
              {setup.trainer.configured &&
                setup.trainer.provider === "OpenRouter" &&
                setup.provider === "OpenRouter" && (
                  <p className="text-muted-foreground mt-2 text-xs leading-5">
                    Shares the Judge&apos;s OpenRouter key.
                  </p>
                )}
            </section>
          )}
        </div>

        <section
          aria-labelledby="privacy-heading"
          className="border-t p-5 md:border-t-0"
        >
          <h2 className="text-sm font-semibold" id="privacy-heading">
            Data and privacy
          </h2>
          <ul className="text-muted-foreground mt-4 space-y-3 text-xs leading-5">
            <li>
              Nothing is sent while you type. Evaluating sends the full sample
              to {setup.provider}.
            </li>
            {setup.trainer?.configured === true && (
              <li>
                The Academy sends practice writing to {setup.trainer.provider},
                and once you have practiced, every Evaluation too.
              </li>
            )}
            <li>
              Evaluations stay on this device at{" "}
              <code>{setup.dataLocation}</code> until you delete them. Local
              data is not backed up.
            </li>
            <li>
              Provider credentials stay on the server. The provider&apos;s data
              policy applies after submission.
            </li>
            <li>
              This app is available on localhost and has no authentication.
            </li>
          </ul>
        </section>
      </div>
    </main>
  );
};

export const Route = createFileRoute("/setup")({
  beforeLoad: ({ context }) => {
    if (context.deployProfile === "hosted") {
      throw redirect({ replace: true, to: "/privacy" });
    }
  },
  component: SetupPage,
  loader: ({ context }) => context.evaluationClient.getSetupStatus(),
});
