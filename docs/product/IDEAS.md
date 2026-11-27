# Ideas

Ideas the owners keep for later. None is planned: an idea becomes work only through its own ADR
or a spec in [`docs/specs/`](../specs/), and an idea that [`REQUIREMENTS.md`](./REQUIREMENTS.md)
puts out of scope needs an ADR first. ADR 0046 parked the first ones. Commit `251d675` holds the
last version of each feature it cut: `git show 251d675:<path>`.

## Direction

### Capture each Text Kind where it is written

Text Kinds (planned in [`2026-11-23-text-kinds.md`](../specs/2026-11-23-text-kinds.md)) are the
core of the product's idea. Each kind would get its own way in (Jhefferson, 2026-11-27):

- Prompts: a hook that sends Grifando the prompts a Learner writes in Claude Code, Codex and
  similar tools.
- Issues and pull requests: a browser extension or a GitHub App, signed in to the Learner's
  GitHub account. Issue comments would be a later Text Kind (#320).
- Everything else: by hand, on the site, as today.

Before it is built: an ADR that brings automatic capture and a browser extension into scope
(FR-05 and the out-of-scope list of `REQUIREMENTS.md`), and a Learner identity beyond the
anonymous session cookie (HR-01), such as signing in with GitHub.

### Gamification

A core idea of the product, cut for now with every game element (ADR 0046). The elements are to
be chosen together, and where they live may change if Grifando becomes a browser extension plus
a site. The Streak, called "ofensiva" in Duolingo's Portuguese, is one it will certainly use.
Other candidates: lessons in the style of Duolingo's, built on Today and the Exercises (#320).

The cut Streak counted a day with any practice and forgave up to two missed days a week, never
two in a row: `packages/core/src/streak.ts` at `251d675`.

### A paid service

The hosted service may be monetized (Jhefferson, 2026-11-27). Today each visitor brings their
own AI key (ADR 0035), and the license keeps commercial use with the owners (ADR 0047).

## Parked for a distant future

### Vocabulary

Terms a Learner keeps to study, each with its meaning in Portuguese, an example sentence and the
Evaluation it came from, saved from a Naturalness Note with "Save to vocabulary". Cut by
ADR 0046: a list with no review gave little. Worth revisiting only with review, for instance
inside the Exercises. The page was `apps/web/src/routes/vocabulary.tsx` at `251d675`.

### Focus Music

A Spotify or YouTube player behind a header button, with the Learner's saved playlists, playing
on across pages (ADR 0039). Cut by ADR 0046 as outside the product's focus. The player was
`apps/web/src/features/music/focus-music.tsx` at `251d675`.
