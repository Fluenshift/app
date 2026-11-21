// The Academy's own navigation on its screens. Ported from Grifando
// src/components/layout/NavLinks.tsx (74dbb9f): Overview opens /academy (docs/adr/0025), and Key
// shows in the hosted profile only, where the browser holds the key (docs/adr/0034).
import type { DeployProfile } from "@fluenshift/contract";
import { cn } from "@fluenshift/ui/utils";
import { Link, useLocation, useRouteContext } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";

const NAV_LINKS = [
  { label: "Overview", to: "/academy" },
  { label: "Today", to: "/today" },
  { label: "Write", to: "/write" },
  { label: "Technical", to: "/technical" },
  { label: "Explain code", to: "/explain-code" },
  { label: "Interview", to: "/interview" },
  { label: "Exercises", to: "/exercises" },
  { label: "Mistakes", to: "/mistakes" },
  { label: "Vocabulary", to: "/vocabulary" },
] as const;

const KEY_LINK = { label: "Key", to: "/settings" } as const;

const linksOf = (deployProfile: DeployProfile) =>
  deployProfile === "hosted" ? [...NAV_LINKS, KEY_LINK] : NAV_LINKS;

const isActive = (pathname: string, to: string): boolean =>
  pathname === to || pathname.startsWith(`${to}/`);

// Desktop: a row of pills where the linen pill marks the active route.
// Mobile: the tabs don't fit, so the row collapses into a disclosure that names
// the current page and opens the full list.
export const AcademyNav = () => {
  const pathname = useLocation({ select: (location) => location.pathname });
  const links = linksOf(
    useRouteContext({
      from: "__root__",
      select: (context) => context.deployProfile,
    })
  );
  const [open, setOpen] = useState(false);
  const listId = useId();
  const current = links.find((link) => isActive(pathname, link.to));

  return (
    <nav aria-label="Academy">
      <ul className="hidden flex-wrap gap-1 pt-5 pb-1 md:flex">
        {links.map((link) => {
          const active = isActive(pathname, link.to);
          return (
            <li key={link.to}>
              <Link
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-pill block px-3.5 py-1.5 text-sm transition-colors",
                  active
                    ? "bg-linen text-foreground ring-border ring-1"
                    : "text-muted-foreground hover:bg-linen/70 hover:text-foreground"
                )}
                to={link.to}
              >
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="pt-4 md:hidden">
        <button
          aria-controls={listId}
          aria-expanded={open}
          className="rounded-pill bg-card ring-border flex h-11 w-full items-center justify-between px-5 text-sm ring-1"
          onClick={() => {
            setOpen((value) => !value);
          }}
          type="button"
        >
          <span>
            <span className="label-mono text-muted-foreground mr-3">Menu</span>{" "}
            {current?.label ?? "Pages"}
          </span>
          <ChevronDown
            aria-hidden="true"
            className={cn("size-4 transition-transform", open && "rotate-180")}
          />
        </button>
        <ul
          className="rounded-card bg-card ring-border mt-2 overflow-hidden ring-1"
          hidden={!open}
          id={listId}
        >
          {links.map((link) => {
            const active = isActive(pathname, link.to);
            return (
              <li
                className="border-border border-b last:border-0"
                key={link.to}
              >
                <Link
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-12 items-center px-4 text-base",
                    active
                      ? "bg-linen text-foreground"
                      : "text-iron hover:bg-linen"
                  )}
                  onClick={() => {
                    setOpen(false);
                  }}
                  to={link.to}
                >
                  {link.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
};
