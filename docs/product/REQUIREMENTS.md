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
| AR-06 | The Mistake Notebook lists the Learner's Mistake Patterns with Mistake Category, canonical example, Occurrence count, last Occurrence and Mastery Level, ordered so frequent and recent patterns come first. | §5.2, §6 |
| AR-07 | Mistake analytics break Occurrences down by Mistake Category over all time and the last 30 days, as a bar list. | §5.3 |
| AR-08 | Exercises come from the Learner's own Mistake Patterns, favoring frequent, unmastered and low-Recall patterns, in four types: multiple choice, fill in the blank, rewrite and translation. | §5.4, §6.1 |
| AR-09 | An Exercise never shows its answer before an Attempt, and an Attempt is graded as `CONTEXT.md` (Attempt) defines. | §5.4, §6.1 |
| AR-10 | Mastery Level moves only as `CONTEXT.md` (Mastery Level) defines. | §5.4, §6, §6.1; ADR 0014 |
| AR-11 | Recall is estimated for each pattern and orders review as `CONTEXT.md` (Recall) defines. | §6.1 |
| AR-12 | Each Exercise is aimed through Category Ability as `CONTEXT.md` (Category Ability) defines. | §6.1 |
| AR-13 | A Streak counts practice as `CONTEXT.md` (Streak) defines. | §6.1 |
| AR-14 | Daily Writing offers one challenge a day from a curated bank, biased toward the Learner's weak categories. | §5.5 |
| AR-15 | Technical English prompts carry one Technical Category from the fixed list. Explain Code asks the Learner to explain a pasted snippet in English, and its feedback concerns the English, never the code. | §5.6, §5.7 |
| AR-16 | Interview Practice is text only and turn based, as `CONTEXT.md` (Interview) defines it. | §5.8; ADR 0010 |
| AR-17 | The Academy dashboard keeps a small, fixed set of cards: today's challenge, recent writing, weak categories, recent Occurrences, one practice recommendation, and one Finding-based trend. | §5.9; ADR 0002 |
| AR-18 | Mistake Patterns, Mastery Level and Recall span Rubric Versions; each Occurrence records the Rubric Version of its Finding. | ADR 0015 |
| AR-19 | The Trainer may fall back to another model only on overload, and records the model that answered. | §4; ADR 0012 |
| AR-20 | Every Trainer answer is validated against its schema before anything is stored; an invalid answer stores nothing and keeps the Learner's text. | §9; QR-03 |

## Hosted profile

The hosted profile replaces Grifando's public site (ADR 0003). It is built in Phase 6 of the
migration.

| ID | Requirement | Source |
| --- | --- | --- |
| HR-01 | One Learner per signed anonymous session cookie: no sign-up, login, email or profile. Every row belongs to one Learner. | ADR 0003 |
| HR-02 | Writing is capped at 5,000 characters and never more than 32 KiB, prompt text at 1,000 characters, code at 2,000, and a request body at 256 KiB, at the edge and in the service. | ADR 0006 |
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
search of History; goals; directional improvement claims; any advice about prompt quality;
code review in Explain Code; voice, speech recognition and pronunciation scoring; social
features, leaderboards and friend streaks; XP, badges and currencies; native mobile apps;
browser extensions; reminders; vocabulary review, whose schema exists but whose feature waits.

Brought into scope by the merge: the hosted Deploy Profile with anonymous sessions
(ADR 0003), several Trainer providers and visitors' own keys (ADR 0012), and the Academy's
simple Streak (Grifando §6.1) and searchable Mistake Notebook (ADR 0020).
