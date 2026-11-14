# 0012. Pin the Judge on OpenRouter; let the Trainer use any provider

- Status: Proposed. Decided on [#5](https://github.com/Fluenshift/app/issues/5); accepted when both owners accept it there.
- Open item from PRE_MIGRATION (judge provider), with Grifando #77. Ledger rows:
  `decision: "adr:0012"`.

## Context

- PE's Judge calls OpenRouter routed to `openai/gpt-5.6-terra` with `store: false`, no tools and
  medium reasoning (`apps/server/src/evaluation/openai-evaluation-model.ts:53,220-221`). Its
  last live calibration passed on 2026-09-16.
- Grifando calls Gemini or Anthropic with the visitor's key, with one fallback model on
  overload (`src/server/ai/resilient.ts`). #77: the fallback records the primary model.
- PRE_MIGRATION: Gemini's free tier may train on submitted text.

## Decision

1. Judge: OpenRouter through `@openrouter/ai-sdk-provider`, one pinned model per Rubric Version
   (today `openai/gpt-5.6-terra`), no retry, no fallback, and the model that answered is
   recorded. It runs as a provisional, uncalibrated Rubric Version until live calibration.
2. Trainer: any AI SDK provider (Gemini, Anthropic, OpenRouter), fallback only on overload,
   recording the model that answered (fixes #77).
3. Keys: the `local` profile reads them from server config; the `hosted` profile takes the
   visitor's keys from request headers only, never stored or logged (BYOK).
4. Gemini's free tier is not offered for the Judge.

## Consequences

- Rows `adr:0012`: the OpenRouter request characterization becomes contract tests over an AI
  SDK mock model (`port`, class C); Grifando's model pins move to Trainer Config.
- If the OpenRouter provider cannot reproduce PE's request (protocol Uncertainties), the Judge
  port is a new Rubric Version, which this decision already assumes.

## Alternatives

- Gemini with the visitor's key for the Judge: free for visitors, but it breaks calibration
  lineage and the free tier may train on learner text.
