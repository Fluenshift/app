// The page frame of the Academy's screens. Ported from Grifando
// src/components/layout/PageHeader.tsx (74dbb9f); the Academy keeps Grifando's page structure
// (docs/adr/0009).
import { cn } from "@grifando/ui/utils";
import type { ReactNode } from "react";

import { AcademyNav } from "./academy-nav";

// The editorial "spread" opening every page: a whisper-weight headline on the
// left, a narrow serif standfirst (and optional actions) in a column beside it.
export const PageHeader = ({
  actions,
  className,
  description,
  size = "display",
  title,
}: {
  readonly actions?: ReactNode;
  readonly className?: string;
  readonly description?: ReactNode;
  readonly size?: "display" | "display-lg";
  readonly title: ReactNode;
}) => (
  <header
    className={cn(
      "grid gap-x-16 gap-y-6 pt-12 pb-12 md:pt-20 md:pb-16 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-end",
      className
    )}
  >
    <h1
      className={cn(
        "rise-in",
        size === "display-lg" ? "text-display-lg" : "text-display"
      )}
    >
      {title}
    </h1>
    {description === undefined && actions === undefined ? null : (
      <div
        className="rise-in space-y-6 lg:pb-1"
        style={{ animationDelay: "80ms" }}
      >
        {description === undefined ? null : (
          <div className="prose-serif text-iron text-lg">{description}</div>
        )}
        {actions === undefined ? null : (
          <div
            className="rise-in flex flex-wrap gap-2"
            style={{ animationDelay: "160ms" }}
          >
            {actions}
          </div>
        )}
      </div>
    )}
  </header>
);

// The page container: the reference's 1200px column with generous gutters, under the Academy's
// own navigation, which Grifando's site header carried.
export const PageShell = ({
  children,
  className,
}: {
  readonly children: ReactNode;
  readonly className?: string;
}) => (
  <main
    className={cn("mx-auto w-full max-w-[1200px] px-6 md:px-12", className)}
  >
    <AcademyNav />
    {children}
  </main>
);

// A section separated by surface tone and space, never by a divider line.
export const Section = ({
  children,
  className,
  tone = "canvas",
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly tone?: "canvas" | "linen";
}) => (
  <section
    className={cn(
      tone === "linen"
        ? "rounded-card bg-linen px-6 py-10 md:px-10 md:py-12"
        : "py-4",
      className
    )}
  >
    {children}
  </section>
);

// Section heading: Inter 300 at 32px. No eyebrow/kicker above it.
export const SectionTitle = ({
  aside,
  children,
}: {
  readonly aside?: ReactNode;
  readonly children: ReactNode;
}) => (
  <div className="mb-8 flex flex-wrap items-baseline justify-between gap-4">
    <h2 className="text-heading">{children}</h2>
    {aside}
  </div>
);
