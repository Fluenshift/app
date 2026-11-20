// Shown in place of an error line when a Trainer action finds no key. Ported from Grifando
// src/components/settings/KeyRequiredNotice.tsx (74dbb9f); in the local profile the key lives in
// the server's configuration, which Setup & privacy explains, until BYOK arrives with Phase 6.
import { Link } from "@tanstack/react-router";

export const KeyRequiredNotice = () => (
  <p className="text-foreground text-sm" role="alert">
    Set up your AI key to get feedback.{" "}
    <Link className="hover:text-iron underline underline-offset-4" to="/setup">
      Set up a key
    </Link>
  </p>
);
