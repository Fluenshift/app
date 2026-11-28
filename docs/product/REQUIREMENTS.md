# Requirements

The product contract. The FR and QR IDs are Prompt Evolution's and are referenced by the live
calibration fixtures (`packages/core/src/live-calibration-fixtures.ts`): never renumber them.
The Academy's requirements use the AR range, mapped to the sections of Grifando's `SPEC.md`;
the hosted Deploy Profile's use the HR range. Evaluation policy lives in
[`RUBRIC.md`](./RUBRIC.md), data handling in [`DATA-POLICY.md`](./DATA-POLICY.md), and the
vocabulary in [`CONTEXT.md`](../../CONTEXT.md).

The Profiles column names the Deploy Profiles a requirement binds (ADR 0003): `local`,
`hosted`, or both.

## Functional

| ID | Requirement | Profiles |
| --- | --- | --- |
| FR-01 | The full journey — submit, inspect, browse, Progress, delete — works in a browser on the Linux host. | local |
| FR-02 | Inbound traffic is accepted through host loopback only. | local |
| FR-03 | No sign-up, login, session, or user administration. | local |
| FR-04 | Product data survives container restart or replacement. | both |
| FR-05 | Only deliberately submitted text is sent or stored. No background capture. | both |
| FR-06 | The exact submitted bytes are stored and returned unnormalized. | both |
| FR-07 | A stable content hash is computed; identical text may be submitted repeatedly. | both |
| FR-08 | Evaluate spelling, grammar, articles, verb tense, word choice, punctuation, and clarity in English Passages only. | both |
| FR-09 | Corrections keep technical meaning and intended tone, and leave non-English text unchanged. | both |
| FR-10 | Every Evaluation has an integer score 0–100, its band, and Findings carrying one approved category, one approved severity, original text, Correction, and explanation. | both |
| FR-11 | Zero Findings is a valid Evaluation and states that no correction is needed. | both |
| FR-12 | Provider, model, Rubric Version, and evaluated English word count are retained and shown. | both |
| FR-13 | Stored records are immutable — readable and deletable only. | both |
| FR-14 | History lists Evaluations newest first with date, summary, score, and band. | both |
| FR-15 | Opening a record shows original text, corrected text, all Findings, all Suggestions, and context. | both |
| FR-16 | Identical text submitted twice creates two separately addressable records. | both |
| FR-17 | Progress covers last 7 days, last 30 days, and all compatible history. | both |
| FR-18 | Finding Rate is the primary measure and shows its underlying counts. | both |
| FR-19 | Category Recurrence counts each sample once per category; recurring Corrections link phrase to Corrections. | both |
| FR-20 | Every Progress Insight reveals the exact source Findings behind it. | both |
| FR-21 | Finding Rate is labeled primary, score secondary, raw counts descriptive; values recompute from retained rows. | both |
| FR-22 | History shows each Rubric Version; Progress defaults to the current one and never merges undeclared-incompatible versions. | both |
| FR-23 | Retain the approved fields only. Never persist API keys, hidden reasoning, or raw HTTP bodies. See [`DATA-POLICY.md`](./DATA-POLICY.md). | both |
| FR-24 | Disclose local data location, receiving provider, separate provider retention, and the loopback-only rule. | local |
| FR-25 | Deliberate deletion removes one Evaluation with its sample, Findings, Suggestions, and metadata; Progress recalculates. | both |
| FR-26 | Protected Technical Content produces no Findings, is excluded from scoring, and is preserved byte-for-byte. | both |
| FR-27 | A sample with no meaning-bearing English Passage is rejected and stored nowhere. | both |
| FR-28 | Context-dependent wording gets no Finding or Correction — at most a Suggestion labeled non-error. | both |
| FR-29 | English inside quotes and blockquotes is evaluated normally. | both |
| OK-01 | `AI_PROVIDER=openrouter` selects OpenRouter for the Trainer, with `OPENROUTER_API_KEY` and the Trainer's existing OpenRouter model pins (`OPENROUTER_MODEL`, `OPENROUTER_FALLBACK_MODEL`). | local |
| OK-02 | With `AI_PROVIDER` empty, no Anthropic or Gemini key and an OpenRouter key present, the Trainer uses OpenRouter. | local |
| OK-03 | An existing Anthropic or Gemini setup behaves exactly as today. | local |
| OK-04 | The Setup page names the Trainer's provider and says when it shares the Judge's key. | local |
| OK-05 | No key appears in any log line or response (as the key-in-logs tests of `apps/server/src/practice/practice-writing-routes.test.ts` check today). | local |

In the hosted profile, HR-01 replaces FR-03, HR-08 replaces FR-24, and FR-02 does not apply:
the site is public (ADR 0003).

## Quality

| ID | Requirement | Profiles |
| --- | --- | --- |
| QR-01 | The same kind of error with the same effect gets the same category and severity within one Rubric Version. | both |
| QR-02 | Progress Insights are reproducible from retained Findings alone. | both |
| QR-03 | A failed or incomplete evaluation never appears as successful history. | both |
| QR-04 | Never imply a Writing Sample stays local when an external model receives it. | both |
| QR-05 | Text inside a Writing Sample cannot alter evaluator policy. | both |
| QR-06 | Feedback is understandable without specialist grammar terminology; necessary terms are explained. | both |
| QR-07 | Container defaults keep access host-only and make accidental external publication evident. | local |
| QR-08 | Every bundled font, icon, and visual asset has a documented license. See [`ASSET-LICENSES.md`](./ASSET-LICENSES.md). | both |
| QR-09 | Scoring concerns English writing only — never prompt or instruction effectiveness. | both |
| QR-10 | Non-English text stays unchanged and affects no score, band, Finding, or insight. | both |
| QR-11 | Suggestions stay visually and statistically distinct from Findings and never touch score, corrected text, or metrics. | both |

## Academy

The Academy turns a Learner's Findings into practice. Each row names the section of
Grifando's `SPEC.md` it comes from and the ADRs that changed it.

| ID | Requirement | Source |
| --- | --- | --- |
| AR-01 | Practice is offered, never required: Evaluation, History and Progress work without the Academy, and the Academy calls no model until the Learner uses it. | §3; ADR 0016 |
| AR-02 | Every text the Learner writes in the Academy, except an answer to an Exercise, is a practice-origin Writing Sample evaluated by the Judge, with the same Findings, score and band as any other. There is no other analysis and no other score; an Attempt is graded deterministically (AR-09). | §5.1; ADR 0002, ADR 0004 |
| AR-03 | The Enrichment adds a Pattern Key, a Mistake Category, the L1 Transfer flag, a natural version, examples and Naturalness Notes to an Evaluation's Findings. It never changes the score, the corrected text or the finding rate. | §5.1; ADR 0004, ADR 0005 |
| AR-04 | Every enriched Finding and Naturalness Note becomes an immutable Occurrence under the Learner's Mistake Pattern for its Mistake Category and Pattern Key; the pattern counts its Occurrences, records the first and last, and keeps a canonical example. | §6 |
| AR-05 | Pattern Keys are normalized on write, as `CONTEXT.md` (Pattern Key) defines. | §6 |
| AR-06 | The Mistake Notebook lists the Learner's Mistake Patterns with Mistake Category, canonical example, Occurrence count, last Occurrence and Mastery Level, ordered so frequent and recent patterns come first. Its search narrows the list, in the browser, to the patterns whose canonical example (original or Correction) or Mistake Category contains the query, whatever its case: it searches what the list shows, so the Pattern Key, which the list never shows, is not searched. | §5.2, §6 |
| AR-07 | Mistake analytics break Occurrences down by Mistake Category over all time and the last 30 days, as a bar list. | §5.3 |
| AR-08 | Exercises come from the Learner's own Mistake Patterns, favoring frequent, unmastered and low-Recall patterns, in four types: multiple choice, fill in the blank, rewrite and translation. | §5.4, §6.1 |
| AR-09 | An Exercise never shows its answer before an Attempt, and an Attempt is graded as `CONTEXT.md` (Attempt) defines. | §5.4, §6.1 |
| AR-10 | Mastery Level moves only as `CONTEXT.md` (Mastery Level) defines. | §5.4, §6, §6.1; ADR 0014 |
| AR-11 | Recall is estimated for each pattern and orders review as `CONTEXT.md` (Recall) defines. | §6.1 |
| AR-12 | Each Exercise is aimed through Category Ability as `CONTEXT.md` (Category Ability) defines. | §6.1 |
| AR-13 | Removed: ADR 0046 cuts every game element for now. | ADR 0046 |
| AR-14 | Daily Writing offers one challenge a day from a curated bank, biased toward the Learner's weak categories. | §5.5 |
| AR-15 | Technical English prompts carry one Technical Category from the fixed list. Explain Code asks the Learner to explain a pasted snippet in English, and its feedback concerns the English, never the code. | §5.6, §5.7 |
| AR-16 | Interview Practice is text only and turn based, as `CONTEXT.md` (Interview) defines it. | §5.8; ADR 0010 |
| AR-17 | The Academy dashboard keeps a small, fixed set of cards: today's challenge, recent writing, weak categories, recently seen Mistake Patterns, one practice recommendation, one Finding-based trend (ADR 0027), and a count of the practice done, as Grifando's dashboard showed them. | §5.9; ADR 0002 |
| AR-18 | Mistake Patterns, Mastery Level and Recall span Rubric Versions; each Occurrence records the Rubric Version of its Finding. | ADR 0015 |
| AR-19 | The Trainer may fall back to another model only on overload, and records the model that answered. | §4; ADR 0012 |
| AR-20 | Every Trainer answer is validated against its schema before anything is stored; an invalid answer stores nothing and keeps the Learner's text. | §9; QR-03 |

## Hosted profile

The hosted profile replaces Grifando's public site (ADR 0003). It was built in Phase 6 of the
migration.

| ID | Requirement | Source |
| --- | --- | --- |
| HR-01 | One Learner per signed anonymous session cookie: no sign-up, login, email or profile. Every row belongs to one Learner. | ADR 0003 |
| HR-02 | Writing is capped at 5,000 characters and never more than 32 KiB, code at 2,000, and a request body at 256 KiB, at the edge and in the service. No request carries prompt text (ADR 0026), so none is capped. | ADR 0006, ADR 0026 |
| HR-03 | Every route that calls a model has fixed-window rate limits per Learner and per hashed IP, kept in PostgreSQL. | ADR 0003 |
| HR-04 | The site serves a Content Security Policy for a static single-page application. | ADR 0003 |
| HR-05 | Visitors bring their own AI keys, handled as `DATA-POLICY.md` (Keys) states. | ADR 0012 |
| HR-06 | The server deletes idle Learners in process, on the schedule `DATA-POLICY.md` (Cleanup and deletion) states. | ADR 0011 |
| HR-07 | A Learner can delete themselves and all their data, as `DATA-POLICY.md` (Cleanup and deletion) states. | ADR 0003 |
| HR-08 | A privacy page in English and Portuguese discloses what is stored, what the providers receive, the idle cleanup and how to delete everything. | ADR 0003 |
| HR-09 | No telemetry or remote analytics, as `DATA-POLICY.md` states. | ADR 0013 |

## Out of scope

Unless an accepted ADR brings it in: automatic capture or proxying of text from other tools;
model-created or editable Error Categories; accounts, sign-up, login and cloud sync; export;
search of History; goals; directional improvement claims; any advice about prompt quality; code
review in Explain Code; voice, speech recognition and pronunciation scoring; social features
and leaderboards; game elements such as XP, badges and currencies (ADR 0046); native mobile
apps; browser extensions; reminders; a list of saved vocabulary and its review (ADR 0046).
Ideas the owners keep for later, some of them on this list, are in [`IDEAS.md`](./IDEAS.md).

Brought into scope by the merge: the hosted Deploy Profile with anonymous sessions
(ADR 0003), several Trainer providers and visitors' own keys (ADR 0012), and the Academy's
searchable Mistake Notebook (ADR 0020).

## Planned

Requirements of the specs in [`docs/specs/`](../specs/), accepted as the plan and not yet built.
A row moves into Functional when the unit that builds it lands with its tests. Text Kind (TK)
rows are in [`2026-11-23-text-kinds.md`](../specs/2026-11-23-text-kinds.md), and Progress chart
(PC) rows in [`2026-11-23-progress-charts.md`](../specs/2026-11-23-progress-charts.md).

| ID | Requirement | Profiles |
| --- | --- | --- |
| PC-01 | Progress returns a time series per period: one bucket per calendar day for 7 and 30 days, per ISO week (Monday start) for all history, each with evaluation count, English word count, Finding count and Finding Rate. Days and weeks are in the time zone the browser sends (IANA name); without one, UTC. | both |
| PC-02 | Buckets with no Evaluations are returned empty, not as zero Finding Rate. | both |
| PC-03 | The series also carries Finding count per Error Category per bucket. | both |
| PC-04 | The series honors the Text Kind filter (TK-07) and stays within one Rubric Version. | both |
| PC-05 | Selecting a bucket opens the evidence of its Evaluations through the existing evidence route. | both |
| PC-06 | Each chart has a text equivalent (a table or a summary sentence) for screen readers, and colors are not the only way to tell series apart. | both |
| PC-07 | A trend with fewer than 3 non-empty buckets shows the points and says the sample is too small to read a trend. | both |
| PC-08 | Comparison by Text Kind shows Finding Rate per kind for the period, with each kind's evaluation count. | both |
| TK-01 | A Writing Sample request may carry one Text Kind; a missing one is stored as `other`. | both |
| TK-02 | An unknown Text Kind is rejected with 400 and stores nothing. | both |
| TK-03 | Every Evaluation retains its Text Kind; it is immutable like the rest of the record (FR-13). | both |
| TK-04 | Evaluations stored before this change read as `other`. | both |
| TK-05 | The Writing Desk offers the Text Kind next to the text box, defaulting to the Learner's last choice in this browser. | both |
| TK-06 | History rows and the Evaluation page show the Text Kind's label. | both |
| TK-07 | Progress and its evidence accept an optional Text Kind filter; without it they behave as today. | both |
| TK-08 | Until a Rubric Version declares kind-aware judging, the Text Kind is not sent to the Judge. | both |
| TK-09 | Practice Evaluations (Academy) are stored as `other`; the Academy offers no selector. | both |
