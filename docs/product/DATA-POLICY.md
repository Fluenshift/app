# Data policy

What Grifando keeps, what it never keeps, and what leaves the machine, for each Deploy
Profile (ADR 0003). Vocabulary is defined in `CONTEXT.md`. Neither profile sends telemetry or
remote analytics; adding any needs a new ADR and a change to this policy (ADR 0013).

## Local profile

### Stored locally

A successful Evaluation stays in the local database until deliberately deleted. No
expiration. The database is PGlite in the data directory the profile configures, `./.data`
when Grifando runs with Docker (ADR 0017).

Original Writing Sample and its content hash; its origin, work or practice; submission and
evaluation timestamps; corrected version and summary; evaluated English word count; score
and band; Findings (category, severity, original text, Correction, explanation); Suggestions
(original text, optional alternative, context explanation); provider, model, Rubric Version;
token usage and latency when the provider reports them. Every row belongs to the one implicit
Learner.

When the Learner uses the Academy, it also stores:

- Mistake Patterns: Pattern Key, Mistake Category, Mastery Level, the occurrence, correct and
  incorrect counts, one example with its Correction, and when the pattern was first seen, last
  seen and last practiced;
- an Occurrence for each Finding folded into a pattern: the Finding's original and corrected
  span, category, severity, explanation, an example, the L1 Transfer flag and the Rubric
  Version;
- an Occurrence for each Naturalness Note: its original and natural span, its explanation, an
  example, the L1 Transfer flag, its place among the notes and the Rubric Version;
- for each enriched Evaluation, the model that enriched it and the natural version of its
  Writing Sample;
- Exercises (type, difficulty, the generated prompt and the model that wrote it) and their
  Attempts (the Learner's answer, whether it was correct, and the feedback);
- Interviews: each question the Trainer asked, the model that asked it, its place in the
  Interview, when it was answered, and the Evaluation of the answer;
- a Category Ability estimate for each Mistake Category.

### Never stored

API keys or other credentials, hidden model reasoning, raw HTTP request or response bodies,
unstructured provider output after validation.

In the local profile, credentials are read server-side through Effect Config, as redacted
values: the Judge's from `OPENROUTER_API_KEY`, the Trainer's from `ANTHROPIC_API_KEY` or
`GEMINI_API_KEY`, as `AI_PROVIDER` chooses. They never reach browser code, History, or logs. Request logging excludes
Writing Sample text and provider bodies, and no URL carries text the Learner wrote
(ADR 0008).

### External transmission

Evaluating sends the full current Writing Sample to OpenRouter, through the AI SDK provider,
routed to the Judge's pinned model (`RUBRIC.md`) with `store: false`, no tools, and no
conversation state (ADR 0012). The provider receives only that sample, the rubric
instructions, and structural annotations.

Once the Learner uses the Academy, from their first practice-origin Writing Sample on (ADR 0041),
the Trainer's provider (Anthropic or Gemini, or OpenRouter in the hosted profile, which routes to
Gemini's models; ADR 0012, ADR 0035) receives:

- to enrich an Evaluation: the whole Writing Sample, of either origin, its Findings, and any
  Explain Code snippet;
- to write Exercises: the Mistake Categories and examples of the patterns they practice;
- to explain an Attempt: the Exercise and the Learner's answer;
- for the interview: its questions and the Learner's answers so far.

OpenRouter says prompt retention is opt-in and off by default, but the routed model provider
has its own logging and retention policy. **This is not a fully local evaluation, and the
product must never describe it as one.** See
[OpenRouter data collection](https://openrouter.ai/docs/guides/privacy/data-collection) and
[provider logging](https://openrouter.ai/docs/guides/privacy/provider-logging).

### Local access boundary

The application has no authentication, so it must stay host-only. Compose publishes to IPv4
loopback explicitly. The server also rejects unexpected Host headers and cross-origin
requests: loopback binding alone does not stop a hostile web page from driving the local app.
CORS is off.

### Deletion

Deleting an Evaluation removes its Writing Sample, Findings, Suggestions, and metadata, and
Progress recalculates without that evidence. It also removes the Occurrences and the Enrichment
record made from it. Each Mistake Pattern those Occurrences belonged to is rebuilt from what
remains, its other Occurrences and the Attempts on its Exercises, so its counts, example, times
and Mastery Level no longer show the deleted Evaluation; a pattern left without an Occurrence
is removed. Exercises and Attempts stay, as the Learner's practice (ADR 0031). The local
profile runs no cleanup: data stays until the Learner deletes it (ADR 0011). There are no
application-managed backups, so deletion cannot be undone through the product. Introducing
backups later requires a new explicit policy.

## Hosted profile

The hosted profile replaces Grifando's public site; it was built in Phase 6 of the migration,
and this section records what the accepted ADRs decided for it.

### Learners and storage

Each Learner is one signed anonymous session cookie: there is no sign-up, login, email or
profile. Every row belongs to that Learner, in PostgreSQL (ADR 0003, ADR 0017). The same
fields as in the local profile are stored, under the hosted input caps (ADR 0006), plus the
time of each Learner's last write, which the idle cleanup reads, and the rate-limit windows
below, kept per Learner and per hashed IP for 2 days (ADR 0011).

The cookie is `HttpOnly`, `SameSite=Lax` and, in production, `Secure`, and lasts a year. It is
signed with the server's `SESSION_SECRET`: changing that secret starts every browser over as a
new, empty Learner, and the idle cleanup deletes the old Learners' data 90 days after their
last write (ADR 0032).

### Keys

Visitors bring their own AI keys. A key travels only in the request headers of the call that
needs it, and is never stored, logged, or sent anywhere but the provider (ADR 0012). An
OpenRouter key runs the Judge and the Trainer; a Gemini or Anthropic key runs the Trainer only,
so feedback on writing needs an OpenRouter key. The hosted Judge never runs on a key from server
configuration (ADR 0035). Each provider receives what External transmission (Local profile)
lists for the Judge or the Trainer that the key runs.

### Cleanup and deletion

The server deletes, once a day, every Learner idle for 90 days, with all their data
(ADR 0011). A Learner can delete themselves and all their data at any time
(`DELETE /api/me`), and can delete one Evaluation as in the local profile.

### Limits and boundary

The rate limits and the Content Security Policy are requirements HR-03 and HR-04 in
`REQUIREMENTS.md`.

### Privacy page

`/privacy` states this policy to visitors in English and Portuguese (HR-08): what is stored, the
hashed IP included, which provider each key reaches, the idle cleanup, and a "Delete my data"
button that calls `DELETE /api/me` and removes the key from the browser. The hosted profile
redirects Setup & privacy, which states the local profile's facts, to it (ADR 0036).

### Cutover from Grifando

Grifando's data is not migrated. For at least 30 days before cutover the old site shows the
date and what happens to the data, and its "Delete my data" keeps working; after cutover its
database is kept read-only for 30 days, then deleted (ADR 0018).
