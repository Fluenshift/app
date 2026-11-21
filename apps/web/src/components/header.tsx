// Ported from PE apps/web/src/components/header.tsx (5e831bb). Setup & privacy speaks for the
// local profile only; in the hosted profile the "Key settings" and "Privacy" links of Grifando's
// site footer (src/components/layout/SiteFooter.tsx, 74dbb9f) take its place (docs/adr/0036).
// Grifando's Focus Music player ends the header in both profiles, as it ended Grifando's site
// header: the root route keeps it mounted, so changing pages never stops the music
// (docs/adr/0039).
import type { DeployProfile } from "@fluenshift/contract";
import { Link, useRouteContext } from "@tanstack/react-router";

import { FocusMusic } from "../features/music/focus-music";

const PRODUCT_LINKS = [
  { exact: true, label: "Writing Desk", to: "/" },
  { exact: false, label: "History", to: "/evaluations" },
  { exact: true, label: "Progress", to: "/progress" },
  { exact: false, label: "Academy", to: "/academy" },
] as const;

const LOCAL_LINKS = [
  { exact: true, label: "Setup & privacy", to: "/setup" },
] as const;

const HOSTED_LINKS = [
  { exact: true, label: "Key settings", to: "/settings" },
  { exact: true, label: "Privacy", to: "/privacy" },
] as const;

const linksOf = (deployProfile: DeployProfile) => [
  ...PRODUCT_LINKS,
  ...(deployProfile === "hosted" ? HOSTED_LINKS : LOCAL_LINKS),
];

const Header = () => {
  const links = linksOf(
    useRouteContext({
      from: "__root__",
      select: (context) => context.deployProfile,
    })
  );

  return (
    <header className="bg-background/95 border-b">
      <div className="mx-auto flex w-full max-w-[88rem] flex-wrap items-center gap-x-8 gap-y-3 px-4 py-4 sm:px-6">
        <Link className="text-base font-semibold tracking-tight" to="/">
          Fluenshift
        </Link>
        <div className="ml-auto sm:order-last">
          <FocusMusic />
        </div>
        <nav
          aria-label="Primary navigation"
          className="grid w-full grid-cols-2 gap-1 text-sm sm:flex sm:w-auto sm:items-center"
        >
          {links.map(({ exact, label, to }) => (
            <Link
              activeOptions={{ exact }}
              activeProps={{
                className: "bg-muted text-foreground",
              }}
              className="text-muted-foreground hover:bg-muted/70 hover:text-foreground rounded-md px-3 py-2 text-center font-medium"
              key={to}
              to={to}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
};

export default Header;
