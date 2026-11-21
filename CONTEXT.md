# Fluenshift: domain language

Fluenshift evaluates the English of a Learner's real writing and turns the mistakes it finds
into practice. It merges two products: the Evaluation axis comes from Prompt Evolution, the
Academy from Grifando. This glossary is the vocabulary for code, tests and UI, independent of
any interface. Evaluation policy is `docs/product/RUBRIC.md`; the decisions at the seams
between the two products are the ADRs in `docs/adr/`.

Each entry says what a term means and, in italics, the synonyms it forbids.

## Everywhere

**Learner**: the person using Fluenshift on their own writing. Every record of writing and
practice belongs to one Learner. The `local` Deploy Profile has one implicit Learner; in the `hosted` profile each
signed session names one (ADR 0003).
_Not: user, account, customer._

**Deploy Profile**: how one installation runs. `local` runs on the Learner's machine, on a
loopback address, with one implicit Learner and the AI keys in server configuration. `hosted`
serves many Learners through sessions, with tighter input caps, rate limits and idle cleanup
(ADR 0003, ADR 0006).
_Not: environment, mode, tenant._

**Judge**: the model that produces Evaluations, pinned per Rubric Version as `RUBRIC.md`
states (ADR 0012).
_Not: grader, evaluator, AI._

**Trainer**: the model that serves the Academy. It enriches Findings, writes Exercises and
asks interview follow-up questions. It may fall back to another model only on overload, and
records the model that answered (ADR 0012).
_Not: Judge, coach, tutor._

## Evaluation axis

**Writing Sample**: an immutable text a Learner deliberately submits for evaluation. Its
origin is work, text written for a real purpose, or practice, text written inside the Academy
(ADR 0010, ADR 0014). It may be a prompt meant for another tool and may mix languages; only
its English Passages are judged. Identical text submitted twice produces two Writing Samples,
because each submission is a new point in history.
_Not: prompt submission, request, query, message, writing session._

**English Passage**: a meaning-bearing span of natural-language English inside a Writing
Sample. Non-English text and Protected Technical Content are excluded, even when the latter
contains English words.
_Not: target text, eligible region._

**Evaluation**: an assessment of one Writing Sample's English Passages under one Rubric
Version: Overall Score, Proficiency Band, corrected version, and zero or more Findings and
Suggestions. Every Writing Sample goes through the Judge's Evaluation, including Academy
practice (ADR 0004); an answer to an Exercise is an Attempt, graded deterministically instead.
Never judges prompt effectiveness, instruction quality, or likely model performance.
_Not: review, analysis, writing analysis, result._

**Overall Score**: the 0 to 100 summary of English-writing quality under one Rubric Version,
derived locally from the Findings. An interpretation aid, not a certification or a Finding
count. It is the only score: no model-supplied grammar, vocabulary, clarity or naturalness
score is requested or kept (ADR 0002).
_Not: grade, percentage correct, CEFR score._

**Proficiency Band**: the named range explaining a score in plain language: Needs revision,
Understandable, Clear, Natural.
_Not: level, grade, CEFR level._

**Finding**: one demonstrable English-writing error, with its Error Category, Finding
Severity, original text, Correction, and explanation. A context-dependent preference is not a
Finding. Findings are what the Academy builds Mistake Patterns from.
_Not: feedback item, issue, mistake record, or a bare "mistake"._

**Finding Severity**: the error's effect on reading and meaning: Minor, Moderate, or Major.
Depends on effect, never on Error Category.
_Not: priority, confidence, category weight._

**Suggestion**: an explicitly non-error alternative for wording that depends on unstated
context or intended nuance. Explains why no definitive judgment is possible, and never
affects corrected text, score, band, or Progress Insights.
_Not: Finding, Correction, recommendation score._

**Error Category**: the fixed classification grouping comparable Findings. Rubric Version 1
permits only Spelling, Article, Verb form/tense, Preposition, Word choice, Grammar/syntax,
Punctuation/capitalization, Clarity, and Other. The Academy's finer Mistake Categories map
onto these (ADR 0005).
_Not: error type, label, Mistake Category._

**Correction**: the replacement for a demonstrable error. Preserves intended meaning,
non-English text, and Protected Technical Content rather than optimizing style or prompt
strategy.
_Not: rewrite, fix._

**Protected Technical Content**: code, structured data, commands, paths, identifiers, or logs
inside a Writing Sample. Excluded from correction and preserved byte for byte.
_Not: writing, prose._

**Finding Rate**: Findings per 100 evaluated English words, of one Evaluation or over a period.
Naturalness Notes never change it (ADR 0004).
_Not: error rate, mistake rate._

**Progress Insight**: a normalized or descriptive observation derived from Evaluations over a
period: Findings per 100 evaluated English words, category recurrence, average score,
distribution, recurring Corrections. Practice-origin Writing Samples stay out of every insight
(ADR 0010, ADR 0030). Insights combine Rubric Versions only under an explicit compatibility
declaration (`docs/product/RUBRIC.md`).
_Not: statistic, metric, trend._

**Rubric Version**: the identifiable evaluation policy that produced an Evaluation. Versions
are incompatible by default, comparable only through an explicit compatibility declaration.
The Academy's practice state spans versions (ADR 0015).
_Not: system prompt version, evaluator version._

## Academy

**Academy**: the practice side of Fluenshift. It builds Mistake Patterns from a Learner's
Findings and offers Exercises to master them. Practice is offered, never required: an
Evaluation works alone (ADR 0016). Inside the Academy the Learner writes first, and every
Exercise comes from their own mistakes.
_Not: course, lessons, coach._

**Enrichment**: the Trainer's pass over one Evaluation's Findings, which runs only when the
Academy is in use: from the Learner's first practice-origin Writing Sample on (ADR 0041). It adds what practice needs and nothing a score depends on: a Pattern Key,
a Mistake Category, the L1 Transfer flag, a natural version and examples, and separate
Naturalness Notes (ADR 0004).
_Not: analysis, second evaluation._

**Mistake Pattern**: one recurring concept a Learner gets wrong, identified by its Mistake
Category and Pattern Key. It counts its Occurrences, keeps a canonical example, and carries a
Mastery Level and a Recall estimate. Patterns span Rubric Versions (ADR 0015).
_Not: mistake record, error type, weakness._

**Occurrence**: one Finding, or one Naturalness Note, as the Academy records it under a
Mistake Pattern, with the Rubric Version of the Evaluation it came from. Immutable.
_Not: mistake record, mistake occurrence, copy of a Finding._

**Pattern Key**: the short slug the Trainer proposes for the concept behind a Finding, such
as `depend-on-preposition`. Normalized on write: lowercased, trimmed, other characters collapsed
to hyphens, and its length capped.
_Not: tag, label, cluster._

**Mistake Category**: the Academy's finer classification of a Finding, one of the eleven
Grifando categories that ADR 0005 maps onto seven Error Categories, assigned by the Enrichment.
Grifando's literal-translation category becomes the L1 Transfer flag. Its unnatural-phrasing
category names the Mistake Patterns that Naturalness Notes grow, and maps to no Error Category
(ADR 0028). The Judge never sees it.
_Not: Error Category, error type._

**Naturalness Note**: the Enrichment's note that a span is correct but unnatural. It never
changes the Overall Score, the corrected text or the finding rate (ADR 0004). It grows its
Mistake Pattern's Occurrences but is never a failed recall (ADR 0020, ADR 0028).
_Not: Finding, Suggestion, unnatural-phrasing error._

**L1 Transfer**: the flag on an Occurrence, of a Finding or of a Naturalness Note, that carries
a pattern over from the Learner's first language. Grifando's literal-translation category becomes this flag on the
category of the underlying error (ADR 0005).
_Not: literal translation category._

**Mastery Level**: how far a Learner has mastered a Mistake Pattern: Active, Improving or
Mastered. Attempts on Exercises for the pattern move it: two consecutive correct Attempts move
Active to Improving, two more move Improving to Mastered, and a wrong Attempt on an Improving
pattern returns it to Active. Reaching Mastered needs an unscaffolded Exercise, a rewrite or a
translation. Mastered is not final: a Mastered pattern whose Recall falls below the threshold
shows as fading, a state derived when the pattern is read and never stored, and a Finding in
new writing that maps to the pattern counts as a failed recall, whatever the Writing Sample's
origin (ADR 0014). Reading a Correction never changes it.
_Not: level, progress, score._

**Recall**: the estimated probability that the Learner still masters a Mistake Pattern, from
a half-life set by the pattern's correct and incorrect counts (simplified Half-Life
Regression). Practice reviews the patterns with the lowest Recall first.
_Not: memory score, retention score._

**Exercise**: one practice item written from a Learner's own Mistake Pattern: multiple
choice, fill in the blank, rewrite, or translation.
_Not: quiz, question, drill._

**Attempt**: one answer a Learner gives to an Exercise, graded deterministically: correct when
it matches any acceptable answer once normalized. An optional explanation of the answer never affects the grade.
_Not: try, submission._

**Category Ability**: an Elo-style estimate of the Learner's ability in one Mistake Category,
used to aim each Exercise at about 70% expected success.
_Not: skill level, rating._

**Streak**: the run of days with at least one practice activity, with limited rest days. No
punishment and no leaderboard.
_Not: score, XP._

**Practice Prompt**: what the Academy asks the Learner to write about: a daily challenge, a
technical topic, a piece of code to explain in English, or an interview question. Free writing
has none. The answer is a practice-origin Writing Sample.
_Not: a bare "prompt", which on the Evaluation axis means text written for another tool._

**Interview**: practice in which the Trainer asks questions and follow-ups. Each answer is a
practice-origin Writing Sample that the Judge evaluates like any other; there is no separate
interview score (ADR 0010).
_Not: mock interview score, fifth score._

**Vocabulary Item**: a term the Learner keeps to study, with its meaning in Portuguese, an
example sentence, and the Evaluation it came from, when it came from one.
_Not: flashcard, word list entry._

## Collisions resolved

| Source term | Fluenshift term |
| --- | --- |
| Grifando's user (`userId`) | Learner |
| Grifando's writing session and writing analysis | a practice-origin Writing Sample and its Evaluation (ADR 0004) |
| "mistake" for one error in one text | Finding on the Evaluation axis; Occurrence in the Academy |
| Grifando's mistake occurrence | Occurrence |
| Grifando's 13 categories | Mistake Category for eleven of them, mapped onto seven Error Categories; the L1 Transfer flag; the Naturalness Note (ADR 0005) |
| Grifando's error and unnatural severities | an Occurrence of a Finding, and a Naturalness Note |
| Grifando's model-supplied scores | none: the Overall Score is the only score (ADR 0002) |
| "prompt" in Grifando's sense | Practice Prompt |
