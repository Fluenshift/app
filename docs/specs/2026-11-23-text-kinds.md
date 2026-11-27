# Spec: Text Kinds

- Status: Draft, 2026-11-23. Answers #320 ("Text kinds as a first-class input" and "Analysis that
  depends on the kind").
- Owner of the gamified Academy work: Jhefferson. This spec does not touch Streak, lessons or
  other game elements.

## Why

Grifando takes a piece of text a Learner wrote, of a known kind, analyzes its English, and
stores the result so the Learner can see trends (#320). Today a Writing Sample has no kind: the
Judge cannot tell a terse prompt to an AI from a PR description, and Progress cannot answer
"is my English in PR descriptions getting better?".

## Goals

1. A Learner can say what kind of text they are submitting in the Writing Desk.
2. Every Evaluation stores its Text Kind, and History and the Evaluation page show it.
3. Progress can be filtered by Text Kind.
4. In a later Rubric Version, the Judge reads the Text Kind as context.

## Non-goals

- Evaluating the technical part of a text. Protected Technical Content stays excluded (FR-26).
- Fetching text from GitHub by URL (a later spec).
- Anything in the Academy. Practice stays out of Progress (ADR 0030), so a kind on practice
  would reach no chart; the Academy is Jhefferson's area (#320).
- Changing Error Categories, severities, the score or the bands.

## Anti-goals

- A kind that changes the score scale. Scores of different kinds must stay comparable, or
  Progress across kinds becomes meaningless.
- A required choice that slows down the common case. Submitting must still be one paste and one
  click.

## Vocabulary

**Text Kind**: what a Writing Sample is, as the Learner declared it. Values:

| Value | Label | Notes |
| --- | --- | --- |
| `prompt` | Prompt to an AI | |
| `issue` | GitHub issue | title and body pasted together |
| `pull-request` | Pull request description | |
| `other` | Other | the default |

`issue-comment` is planned (#320, "later") and is out of this spec. Add **Text Kind** to
`CONTEXT.md` with `_Not: type, category, origin._` (the contract already uses `kind` as a union
tag and `origin` for work/practice).

## Requirements

New IDs in `docs/product/REQUIREMENTS.md`, range TK:

| ID | Requirement | Profiles |
| --- | --- | --- |
| TK-01 | A Writing Sample request may carry one Text Kind; a missing one is stored as `other`. | both |
| TK-02 | An unknown Text Kind is rejected with 400 and stores nothing. | both |
| TK-03 | Every Evaluation retains its Text Kind; it is immutable like the rest of the record (FR-13). | both |
| TK-04 | Evaluations stored before this change read as `other`. | both |
| TK-05 | The Writing Desk offers the Text Kind next to the text box, defaulting to the Learner's last choice in this browser. | both |
| TK-09 | Practice Evaluations (Academy) are stored as `other`; the Academy offers no selector. | both |
| TK-06 | History rows and the Evaluation page show the Text Kind's label. | both |
| TK-07 | Progress and its evidence accept an optional Text Kind filter; without it they behave as today. | both |
| TK-08 | Until a Rubric Version declares kind-aware judging, the Text Kind is not sent to the Judge. | both |

TK-08 keeps Rubric Version `1-provisional` unchanged: storing the kind is metadata, not
evaluator policy, so no Evaluation becomes incompatible (FR-22).

## Kind-aware judging (phase 2)

A new Rubric Version (`2-provisional`) adds one context line to the Judge's prompt per Text Kind,
under RUBRIC.md's existing rule "Judge concise technical prose in its intended context":

- `prompt`: imperative, fragments and terse instructions are normal; judge clarity of the ask.
- `issue`: expect a problem statement; lists and headings are normal.
- `pull-request`: Markdown structure, bullet fragments and section headings are normal; judge
  the prose inside them.
- `other`: today's behavior.

The Text Kind is data inside the prompt, never instructions (QR-05). The Error Categories,
severities and score stay the same, so the anti-goal holds. Phase 2 needs its own ADR and the
new Rubric Version; Progress keeps versions apart as FR-22 already requires.

## Where it lands

- `packages/contract/src/evaluation.ts`: `TEXT_KINDS`, `TextKind`, an optional `textKind` on
  `WritingSampleRequest`, a `textKind` on `Evaluation` and `EvaluationSummary`, an optional
  `textKind` filter on the Progress and evidence requests (shape in the Progress charts spec).
- `packages/db`: a `text_kind` column with a check constraint like `evaluations_origin_check`,
  default `other`, through `pnpm db:generate`.
- `apps/server/src/app.ts`: `POST /api/evaluations` passes it through, `POST
  /api/practice-writing` stores `other`; `GET /api/progress` and the evidence route read the filter.
- `apps/web`: the selector on the Writing Desk; the label in History
  and on the Evaluation page; the filter in Progress's period column.
- `README` and the PE importer: imported Evaluations are `other`.

## Acceptance

- Each TK row has a test that fails before its change (AGENTS.md: tests first).
- Playwright: submit a `pull-request` sample, see it in History with its label, filter Progress
  to Pull requests and see only it.
- The hosted Docker smoke still passes.

## Left to the builder

- The selector's control (segmented buttons or a select) within the current design.
- Where "last choice" is kept in the browser (localStorage is enough; it is a convenience).

## Approaches considered

1. **Store the kind first, judge with it later (chosen).** Ships value now (filtering, labels)
   without a new Rubric Version, and keeps phase 2 a clean, reviewable change of evaluator
   policy.
2. Judge with the kind from day one. Faster to the "analysis depends on the kind" goal, but
   every change to the Judge's prompt is a new Rubric Version, and v1 is still provisional and
   uncalibrated: two moving parts at once.
3. Detect the kind automatically. No extra click, but wrong guesses would mislabel Progress, and
   the Learner already knows what they pasted.
