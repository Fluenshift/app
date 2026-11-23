# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Brazilian developers, native speakers of Portuguese, who write English every working day: prompts to AI tools, GitHub issues, pull request descriptions, and later issue comments. Their job is to write that English correctly and naturally, and to make fewer of the same mistakes over time. Confirmed with the owners on 2026-11-23.

## Product Purpose

Fluenshift takes a piece of English a Learner wrote, evaluates only its English, stores the result, and turns the Learner's own mistakes into practice. Success is a Learner whose Finding Rate falls over weeks of real work, and who can see that trend (#320).

## Positioning

- It judges only the English. Code, commands, paths, identifiers and logs (Protected Technical Content) are excluded from scoring and kept byte for byte, which a general grammar checker does not do.
- Its evaluation follows a written, versioned rubric (`docs/product/RUBRIC.md`) with an Overall Score from 0 to 100, a Proficiency Band and categorized Findings, so results are comparable over time rather than one-off chat answers.
- It keeps every Evaluation, so Progress shows which errors recur and whether they are fading.
- The Academy builds practice from the Learner's own recorded mistakes, not generic drills. Its game elements (Streak and beyond) belong to Jhefferson's area (#320).

## Operating Context

- The Learner pastes text written for a real purpose (work) on the Writing Desk, or writes practice inside the Academy.
- Two Deploy Profiles: `local`, one Learner in Docker on loopback with no login and keys from server config; `hosted`, the public site with sessions, rate limits and the visitor's own AI keys (BYOK).
- The Judge (evaluation) runs on OpenRouter with one pinned model per Rubric Version; the Trainer (Academy enrichment) runs on Anthropic, Gemini or OpenRouter.
- Vocabulary is fixed in `CONTEXT.md` (Learner, Writing Sample, Evaluation, Finding, Suggestion, Text Kind, Academy).

## Capabilities and Constraints

- Evaluation side: Writing Desk, History, Progress with evidence behind every insight, Setup and privacy, a one-time import of Prompt Evolution's history.
- Academy side: Overview, Today, Write, Technical, Explain code, Interview, Exercises, Mistakes, Vocabulary; Focus music. None of these is to be removed (owners, 2026-11-23).
- Planned: Text Kinds and Progress charts (`docs/specs/`, issues #336 to #346).
- Inviolable: no remote analytics (ADR 0013); only deliberately submitted text is sent or stored; never imply a Writing Sample stays local when an external model receives it; API keys are never stored or logged, and the hosted profile uses the visitor's keys; the local profile has no sign-up or login.
- Open: the product's name, logo and visual style (#333); a redesign of the interface is expected (#320).

## Brand Commitments

"Fluenshift" is a working name, and the repository is `Fluenshift/app` (#333). The current look and the nine latin font faces come from Grifando; their origin is still to be recorded in `docs/product/ASSET-LICENSES.md`. No brand asset is binding until the owners decide #333.

## Evidence on Hand

No users, testimonials, metrics or press exist yet. The hosted site is not live for this repository (grifando.vercel.app still serves Grifando). Do not fabricate any of these.

## Product Principles

1. The English, never the code: anything technical is protected, not judged.
2. Comparable over time: every number traces back to retained Findings under one Rubric Version.
3. Built from the Learner's own mistakes, not generic exercises.
4. Privacy by default: nothing leaves without a deliberate submit, and the screen says where it goes.
