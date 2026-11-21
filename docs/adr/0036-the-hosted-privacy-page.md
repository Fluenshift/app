# 0036. The hosted privacy page states the hosted profile's facts; each profile links its own pages

- Status: Accepted on 2026-11-20 by the session (ADR 0020), with the Phase 6 privacy unit (#240).
- Phase 6, requirements HR-07 and HR-08. No ledger row changes its disposition: Grifando's
  `/privacy` page and `DeleteMyDataButton` have no test at the baseline and port from source
  (ADR 0025, decision 5).

## Context

- HR-08 asks for a privacy page in English and Portuguese that discloses what is stored, what
  the providers receive, the idle cleanup and how to delete everything. In the hosted profile it
  replaces FR-24, which PE's Setup & privacy page (`/setup`) meets in the local profile.
- Grifando's page (`src/app/privacy/page.tsx`, 74dbb9f) sends the text "to the AI provider you
  chose (Gemini or Anthropic)", names Vercel Web Analytics, and calls Evaluations "analyses" and
  Mistake Patterns "mistakes". Since then an OpenRouter key runs the Judge and the Trainer, and a
  Gemini or Anthropic key runs the Trainer only (ADR 0035); neither profile sends analytics
  (ADR 0013); and `CONTEXT.md` forbids "analysis" and a bare "mistake". The rate limits keep a
  hash of the client IP for 2 days (ADR 0033, `DATA-POLICY.md`), as Grifando's did, and
  Grifando's page never said so.
- Its "Delete my data" button calls `DELETE /api/me`, which the hosted profile answers and the
  local profile refuses with 404 (#216), then removes the browser's key and loads `/` again: the
  answer expires the session cookie, and the session gate mints a new one only on a page load
  (ADR 0032).
- In the hosted profile `/setup` says that the app runs on localhost with no authentication, and
  asks for `OPENROUTER_API_KEY`, which that profile ignores (ADR 0035). The primary navigation
  links to it in both profiles.
- Grifando's site footer links "Write", "Exercises", "Privacy", "Key settings" and Grifando's
  GitHub repository, and reads "© 2026 Grifando". Fluenshift's shell is PE's, one primary
  navigation and no footer (ADR 0009); the Academy navigation already carries Write, Exercises
  and, in the hosted profile, Key (ADR 0034).

## Decision

1. In the hosted profile `/privacy` renders Grifando's page, English then Portuguese, with its
   "Delete my data" button: a confirmation, `DELETE /api/me` through the Academy client, then the
   browser's key removed and a full page load at `/`. A failed deletion keeps the key and shows a
   rate limit's message, or Grifando's own. In the local profile `/privacy` redirects to `/setup`.
2. The copy stays Grifando's except where its facts changed:
   - the provider each key reaches: an OpenRouter key sends the text to OpenRouter, which routes
     it to the models that give the feedback and write the exercises; a Gemini or Anthropic key
     sends Google or Anthropic only what the Academy needs to write exercises, explain answers
     and ask interview questions. OpenRouter's statement on retention goes beside Grifando's
     note on Gemini's free tier;
   - the hashed IP that the rate limits keep for 2 days;
   - "We collect no analytics or telemetry" in place of Vercel Web Analytics;
   - the names of `CONTEXT.md`: Evaluations and Mistake Patterns in place of "analyses" and
     "mistakes", "avaliações" and "padrões de erro" in Portuguese, and "No sign-up" in place of
     "No account";
   - Fluenshift in place of Grifando.
3. In the hosted profile `/setup` redirects to `/privacy`, and the primary navigation ends with
   the footer's labels, "Key settings" (`/settings`) and "Privacy" (`/privacy`), in place of
   "Setup & privacy". The local profile keeps its page and its navigation.
4. Grifando's site footer does not port.

## Consequences

- Each profile links only the pages that speak for it: a hosted visitor never reads that the
  app runs on localhost, and a local Learner never reaches a deletion the local server refuses.
- The page restates facts that ADR 0013, ADR 0033 and ADR 0035 decide: a change to analytics,
  the rate limits or the providers changes the page and its screen test in the same pull
  request.
- The hashed-IP rate-limit windows outlive a deletion by up to 2 days, as Grifando's did; the
  page states their 2 days.
- The sitemap unit lists `/privacy` and `/settings`, which only the hosted profile serves.

## Alternatives

- Keep "Setup & privacy" in the hosted navigation, linked to `/privacy`: the label promises the
  setup that `/settings` holds.
- Port the footer: its Write and Exercises links repeat the Academy navigation, its GitHub link
  and its copyright name the product being retired, and it would be a second site navigation in
  a shell that has one.
- A hosted variant of `/setup`: two pages would state the hosted facts, and FR-24 does not apply
  to that profile.
- Grifando's copy as it stands: it names providers that no longer give feedback and an analytics
  service that ADR 0013 rules out, and leaves out the hashed IP.
