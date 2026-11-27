# 0046. What stays, changes and goes after the feature review

- Status: Accepted on 2026-11-27. Jhefferson, who leads Grifando's product decisions, decided
  each feature of #320 in a session; the review and the decisions are comments on #320 (#355).
- Supersedes ADR 0018, decision 2 (the import of PE's local history), and ADR 0039 (Focus
  Music). Each cut below lands as its own unit, which removes the feature's code, rows and terms.

## Context

- The migration is done (ADR 0044), and the owners redesign the interface (ADR 0043, #320,
  #333). Before the redesign, Jhefferson reviewed every feature by what the Learner does with it
  and gets back, to settle what the redesign must cover.
- From 2026-11-27 Jhefferson leads Grifando's product decisions, and Levy is the product owner
  of `Fluenshift/gargalo`. For #320 and #333 a session proposes options and Jhefferson chooses;
  every other decision stays with the sessions (ADR 0020).

## Decision

1. Keep: the Writing Desk, History, Progress, Today, the technical Practice Prompts, Explain
   code, Exercises, the Mistake Notebook, Mastery Level, Recall and Category Ability, the folding
   of work Evaluations into the Academy (ADR 0041), both Deploy Profiles, the privacy page and
   "Delete my data", the hosted key settings, `robots.txt`, `sitemap.xml` and the link preview,
   and the planned Text Kinds and Progress charts (`docs/specs/`). Live calibration (G13) stays
   deferred until the owners schedule it.
2. Cut, each in its own unit:
   1. The one-time import of PE's local history: the importer, its `pe_imports` table and the
      README's section.
   2. Vocabulary Items: the page, its routes, the "Save to vocabulary" action and the
      `vocabulary_items` table.
   3. The Streak, and with it every game element, for now.
   4. Focus Music, with the `frame-src` its players need in the hosted Content Security Policy.
3. Change, in the redesign:
   1. One settings area replaces the local Setup & privacy page and the hosted Key settings and
      Privacy pages.
   2. A smaller Academy home replaces the Overview dashboard.
   3. Free practice writing, `/write` without a Practice Prompt, merges into the Writing Desk,
      which gains a way to mark a text as practice. Practice Prompts keep their writing screen.
   4. The technical Practice Prompts may become a source of Today's challenges instead of a page
      of their own, and the Mistake Notebook's per-category bars may move to Progress.
4. Defer: Interview stays as it is, with no new work, until the decisions above are built.
5. The main product is the `hosted` Deploy Profile: a public service people use, in the style of
   Duolingo. The `local` profile stays for anyone who runs their own instance, under the license
   of ADR 0047.
6. Text Kinds are the core of the product's idea, and each kind is meant to get its own way in: a
   hook that captures the prompts a Learner sends to Claude Code, Codex and similar tools; a
   browser extension or a GitHub App, signed in to the Learner's GitHub account, for issues and
   pull requests; and the site, by hand, for the rest. `docs/product/IDEAS.md` records it.
7. Parked ideas, the cut features worth revisiting included, live in `docs/product/IDEAS.md`. An
   idea becomes work only through its own ADR or spec.

## Consequences

- PE's local history is not imported. PE's archived repository and its clones keep it.
  ADR 0044's list of what waits for the owners loses the import.
- Cutting the Streak removes AR-13 and the Streak card of AR-17, and `CONTEXT.md` loses the term.
  Exercises, Mastery Level, Recall and Category Ability are learning mechanics, not game elements,
  and stay. Gamification returns only under its own ADR, as one design: which elements, and where
  they live if Grifando becomes a browser extension plus a site.
- Cutting Vocabulary deletes every Learner's saved terms with the table, and `CONTEXT.md` loses
  the Vocabulary Item term. The Mistake Category named vocabulary is unrelated and stays.
- The redesign (#333) covers what decision 1 keeps and decision 3 changes. Interview keeps its
  page and its route, takes the new style like any page, and gets nothing new.
- Decision 6 needs an ADR before any of it is built: FR-05 admits only deliberately submitted
  text, and `REQUIREMENTS.md` puts automatic capture, browser extensions, accounts and sign-in
  out of scope. A GitHub App signed in to the Learner's account needs a Learner identity beyond
  the anonymous session cookie (HR-01).

## Alternatives

- Keep the Streak while gamification is designed: rejected, since Jhefferson wants every game
  element chosen together, and the Streak may change with them.
- Keep Vocabulary as it is: a list with no review, whose review the requirements already put out
  of scope.
- Keep free practice writing as its own page: two places to write a text and get an Evaluation.
- Make the `local` profile the product and drop `hosted`: rejected, since the owners mean
  Grifando to be a service.
