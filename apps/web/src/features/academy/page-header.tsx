// The page frame of the Academy's screens. Ported from Grifando
// src/components/layout/PageHeader.tsx (74dbb9f); the Academy keeps Grifando's page structure
// (docs/adr/0009).
import { cn } from "@fluenshift/ui/utils";
import type { ReactNode } from "react";

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

// The page container: the reference's 1200px column with generous gutters.
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
    {children}
  </main>
);
