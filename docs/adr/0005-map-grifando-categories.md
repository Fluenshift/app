# 0005. Map Grifando's 13 categories onto PE's 9

- Status: Proposed. Decided on [#5](https://github.com/Fluenshift/app/issues/5); accepted when both owners accept it there.
- Seam: Phase 1 (d). No ledger row waits on it; Academy units implement it.

## Context

PE's nine Error Categories are fixed by Rubric Version 1 (`docs/product/RUBRIC.md`). Grifando
has thirteen (`enum MistakeCategory` in `prisma/schema.prisma`). PRE_MIGRATION: PE's
categories are the measured level, Grifando's finer ones a pedagogical sublevel, and
`LITERAL_TRANSLATION` becomes the `l1Transfer` flag.

## Decision

| Grifando | PE Error Category | Note |
| --- | --- | --- |
| `ARTICLES` | Article | |
| `PREPOSITIONS` | Preposition | |
| `VERB_TENSE` | Verb form/tense | |
| `SUBJECT_VERB_AGREEMENT` | Verb form/tense | RUBRIC puts agreement here |
| `VOCABULARY` | Word choice | |
| `COLLOCATION` | Word choice | RUBRIC: invalid collocation |
| `WORD_ORDER` | Grammar/syntax | |
| `PRONOUNS` | Grammar/syntax | RUBRIC: pronoun use |
| `COUNTABLE_UNCOUNTABLE` | Grammar/syntax | number agreement |
| `SPELLING` | Spelling | |
| `PUNCTUATION` | Punctuation/capitalization | |
| `UNNATURAL_PHRASING` | none | not an error: the "correct but unnatural" channel (ADR 0004) |
| `LITERAL_TRANSLATION` | category of the underlying error | becomes `l1Transfer = true` |

PE's Clarity and Other have no Grifando counterpart. The Trainer enrichment assigns the
sublevel; the Judge never sees it.

## Consequences

- Academy analytics and exercise targeting group by the sublevel and roll up to PE's
  categories. Prisma enums become literals in `packages/contract`.

## Alternatives

- Make Grifando's categories the measured level: breaks Rubric Version 1 and its calibration.
