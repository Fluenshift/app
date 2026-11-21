// Shown in place of an error line when a Trainer action finds no key. Ported from Grifando
// src/components/settings/KeyRequiredNotice.tsx (74dbb9f). The hosted profile's key lives in the
// browser, which /settings stores; the local profile's lives in the server's configuration, which
// Setup & privacy explains (docs/adr/0034).
import { Link, useRouteContext } from "@tanstack/react-router";

export const KeyRequiredNotice = () => {
  const deployProfile = useRouteContext({
    from: "__root__",
    select: (context) => context.deployProfile,
  });

  return (
    <p className="text-foreground text-sm" role="alert">
      Set up your AI key to get feedback.{" "}
      <Link
        className="hover:text-iron underline underline-offset-4"
        to={deployProfile === "hosted" ? "/settings" : "/setup"}
      >
        Set up a key
      </Link>
    </p>
  );
};
