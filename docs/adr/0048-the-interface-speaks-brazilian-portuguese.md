# 0048. The interface speaks Brazilian Portuguese

- Status: Accepted on 2026-11-28. Jhefferson chose it in a session, among the options the session
  gave for #333: Portuguese, English as today, or both behind a switcher (#370).
- Amends ADR 0046's redesign (#333): the redesign's units write the new copy.

## Context

- Grifando is meant for Brazilian developers who write English at work, and its main product is
  the hosted service, in the style of Duolingo (ADR 0046, decision 5). Duolingo speaks the
  learner's language and teaches the other one.
- The interface is in English today, and so were the four visual directions of #333's first
  round. The Judge writes each Finding's explanation in English, and the Trainer's prompts say
  "Write in English", with a short Portuguese contrast allowed when a mistake comes from
  Portuguese.
- The explanations already lean on Portuguese: an L1 Transfer note says that "depend of" mirrors
  "depender de". A Learner who reads them in their own language understands the rule faster.

## Decision

1. Everything the interface writes is in Brazilian Portuguese: navigation, headings, buttons,
   notices, empty states, errors, settings, the privacy page's Portuguese version, and the labels
   of Error Categories, Mistake Categories, severities, Proficiency Bands and Text Kinds.
2. The explanations the models write are in Brazilian Portuguese too: the Judge's explanation of
   each Finding and Suggestion, and the Trainer's Enrichment, Naturalness Notes, answer
   explanations and Exercise feedback.
3. English stays where English is the subject: the Learner's text, each Correction, the natural
   version, the English examples, and the practice itself (Practice Prompts, Exercises and their
   answers, Interview questions). A Portuguese source sentence of a translation Exercise stays
   Portuguese.
4. One language, with no switcher. The privacy page keeps its English version (HR-08).
5. Code, tests, documents and `CONTEXT.md`'s terms stay in English. `CONTEXT.md` gains the
   Portuguese word the interface shows for each term a Learner sees, chosen with the redesign's
   visual language, and the interface uses only that word.
6. Each part changes with the work that already touches it:
   1. The interface's copy, screen by screen, in the redesign's units (#333). The current pages
      are not translated, since the redesign replaces them.
   2. The Trainer's prompts in a unit of their own, since the Trainer has no Rubric Version.
   3. The Judge's prompt in the next Rubric Version (2-provisional, #340), whose live calibration
      (G13) waits for the owners, since the Judge's prompt is pinned per Rubric Version.

## Consequences

- Every screen test asserts Portuguese copy once its screen is redesigned; until then the old
  screens keep their English tests.
- The pages declare `lang="pt-BR"`, and the Learner's text, Corrections and English examples
  carry `lang="en"`, so screen readers switch voice where the language switches.
- Until #340 lands, the Judge's explanations stay in English beside a Portuguese interface. The
  redesign shows them as they come and does not translate them.
- Rubric Version 2-provisional changes two things the calibration must cover: the Text Kind and
  the explanation language.

## Alternatives

- English, as today: total immersion and no translation work, but a beginner meets every rule in
  the language they are still learning, and the product reads as foreign to its audience.
- Both languages behind a switcher: every string passes through translation tables, and every
  screen needs its tests in two languages. It doubles the copy work while the redesign is still
  choosing the copy. A switcher can come later under its own ADR.
