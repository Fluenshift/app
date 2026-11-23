# Spec: One AI key in the local profile

- Status: Draft, 2026-11-23. Small change.

## Why

In the local profile a Learner needs two keys before the whole product works: `OPENROUTER_API_KEY`
for the Judge (Writing Desk) and `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` for the Trainer
(Academy enrichment, exercises, interview). The Setup page shows two "Needs setup" cards. The
Trainer already supports OpenRouter (`TrainerProvider` in `packages/env/src/trainer.ts`, ADR
0012), but the local config never selects it: `AI_PROVIDER` picks Gemini or falls back to
Anthropic.

## Goal

With only `OPENROUTER_API_KEY` set, both the Judge and the Trainer work locally.

## Non-goals

- Changing the Judge's provider or model (pinned per Rubric Version, ADR 0012).
- The hosted profile's keys (BYOK from request headers stays as it is).

## Requirements

| ID | Requirement | Profiles |
| --- | --- | --- |
| OK-01 | `AI_PROVIDER=openrouter` selects OpenRouter for the Trainer, with `OPENROUTER_API_KEY` and the Trainer's existing OpenRouter model pins (`OPENROUTER_MODEL`, `OPENROUTER_FALLBACK_MODEL`). | local |
| OK-02 | With `AI_PROVIDER` empty, no Anthropic or Gemini key and an OpenRouter key present, the Trainer uses OpenRouter. | local |
| OK-03 | An existing Anthropic or Gemini setup behaves exactly as today. | local |
| OK-04 | The Setup page names the Trainer's provider and says when it shares the Judge's key. | local |
| OK-05 | No key appears in any log line or response (as the key-in-logs tests of `apps/server/src/practice/practice-writing-routes.test.ts` check today). | local |

## Where it lands

- `packages/env/src/trainer.ts`: the provider choice and `localKey`.
- `apps/server/src/trainer-setup.ts` and the Setup page copy.
- `README.md`: one line on the single-key setup.

## Approaches considered

1. **Default the Trainer to OpenRouter when it is the only key (chosen).** Zero setup for the
   common case, explicit override still possible.
2. Only add `AI_PROVIDER=openrouter`. Simpler, but the Learner must know to set it.
