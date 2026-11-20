// The technical Practice Prompts, by Technical Category. Ported from Grifando
// src/app/technical/page.tsx (74dbb9f): the bank is packages/core's, and each prompt opens
// /write, which resolves it from its own URL (docs/adr/0025).
import { TECHNICAL_CATEGORIES } from "@fluenshift/contract";
import { getTechnicalPromptsByCategory } from "@fluenshift/core/technical-prompts";
import { createFileRoute, Link } from "@tanstack/react-router";

import { PageHeader, PageShell } from "../features/academy/page-header";
import { TECHNICAL_CATEGORY_LABELS } from "../features/academy/technical-category-labels";

const TechnicalPage = () => (
  <PageShell>
    <PageHeader
      description="Practice writing about the topics developers actually explain. Pick a prompt to start."
      title="Technical English"
    />
    <div className="space-y-16">
      {TECHNICAL_CATEGORIES.map((category) => (
        <section
          className="grid gap-x-16 gap-y-4 lg:grid-cols-[280px_minmax(0,1fr)]"
          key={category}
        >
          <h2 className="text-heading-sm">
            {TECHNICAL_CATEGORY_LABELS[category]}
          </h2>
          <ul className="border-border border-t">
            {getTechnicalPromptsByCategory(category).map((prompt) => (
              <li className="border-border border-b" key={prompt.id}>
                <Link
                  className="group hover:bg-card flex items-baseline justify-between gap-6 py-4"
                  search={{ promptId: prompt.id }}
                  to="/write"
                >
                  <span className="prose-serif text-lg">{prompt.text}</span>
                  <span
                    aria-hidden="true"
                    className="text-muted-foreground group-hover:text-foreground shrink-0 text-sm"
                  >
                    Write →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  </PageShell>
);

export const Route = createFileRoute("/technical")({
  component: TechnicalPage,
});
