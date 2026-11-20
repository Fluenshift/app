// The Learner's vocabulary and the form that adds to it. Ported from Grifando
// src/app/vocabulary/page.tsx (74dbb9f): the list comes from the server, and the form's prefill
// from the router's history state, never from the URL (docs/adr/0025).
import {
  createFileRoute,
  getRouteApi,
  useLocation,
} from "@tanstack/react-router";

import { PageHeader, PageShell } from "../features/academy/page-header";
import { RemoveVocabularyButton } from "../features/academy/remove-vocabulary-button";
import { VocabularyForm } from "../features/academy/vocabulary-form";
import "../features/academy/vocabulary-prefill";

const routeApi = getRouteApi("/vocabulary");

const VocabularyPage = () => {
  const items = routeApi.useLoaderData();
  const prefill = useLocation({
    select: (location) => location.state.vocabularyPrefill,
  });

  return (
    <PageShell>
      <PageHeader
        description="Words and expressions worth keeping, with what they mean in Portuguese and a sentence that uses them."
        title="Vocabulary"
      />

      <div className="grid gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,1fr)_400px]">
        <section aria-labelledby="saved-title">
          <div className="mb-6 flex items-baseline justify-between gap-4">
            <h2 className="text-heading" id="saved-title">
              Saved
            </h2>
            <span className="label-mono text-muted-foreground">
              {items.length} {items.length === 1 ? "entry" : "entries"}
            </span>
          </div>
          {items.length === 0 ? (
            <p className="prose-serif text-iron text-lg">
              Nothing saved yet. Use &ldquo;Save to vocabulary&rdquo; on a
              mistake, or add a word here.
            </p>
          ) : (
            <ul className="border-border border-t">
              {items.map((item) => (
                <li
                  className="border-border flex items-start justify-between gap-4 border-b py-5"
                  key={item.id}
                >
                  <div className="min-w-0 space-y-1.5">
                    <p className="text-subheading">{item.term}</p>
                    <p className="text-muted-foreground">{item.meaningPt}</p>
                    <p className="prose-serif text-iron italic">
                      &ldquo;{item.exampleSentence}&rdquo;
                    </p>
                  </div>
                  <RemoveVocabularyButton id={item.id} term={item.term} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          aria-labelledby="add-title"
          className="lg:order-first lg:col-start-2"
        >
          <h2 className="text-heading mb-6" id="add-title">
            Add a word
          </h2>
          {/* Prefilled by a mistake's "Save to vocabulary"; keyed so a new prefill resets the
              form. */}
          <VocabularyForm
            initialExample={prefill?.example}
            initialTerm={prefill?.term}
            key={prefill?.term ?? ""}
            sourceEvaluationId={prefill?.sourceEvaluationId}
          />
        </section>
      </div>
    </PageShell>
  );
};

export const Route = createFileRoute("/vocabulary")({
  loader: ({ context }) => context.academyClient.listVocabulary(),
  component: VocabularyPage,
  preloadStaleTime: 0,
});
