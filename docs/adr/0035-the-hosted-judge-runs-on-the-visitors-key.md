# 0035. The hosted Judge runs on the visitor's OpenRouter key

- Status: Accepted on 2026-11-20 by the session (ADR 0020), on #228. #231 and #232 implement
  it.
- Phase 6, requirement HR-05. No ledger row changes its disposition.

## Context

- ADR 0012 pins the Judge on OpenRouter (decision 1), lets the Trainer run on any AI SDK
  provider, OpenRouter included (decision 2), has the local profile read keys from server
  configuration and the hosted profile take the visitor's keys from request headers only
  (decision 3), and offers no free Gemini tier for the Judge (decision 4). The alternative it
  rejected, a Judge on the visitor's Gemini key, was the one "free for visitors".
- The code reads `OPENROUTER_API_KEY` for the Judge in both profiles (`JudgeConfig`,
  `OpenRouterEvaluationModelLive`), although `JudgeConfig` says that the hosted profile takes the
  visitor's key. A hosted deploy that set the variable would pay for every visitor's Evaluation,
  bounded only by the `analysis` rate limit (ADR 0033).
- The browser keeps one key, for Gemini or Anthropic, and sends it in `x-ai-provider` and
  `x-ai-key` with the Trainer's calls (ADR 0034). No key a visitor can bring today runs the
  Judge.
- Every flow of the product runs the Judge: the Writing Desk, practice writing, interview
  answers, and the Exercises, which come from the patterns Evaluations find.

## Decision

1. In the hosted profile the Judge runs only on the visitor's OpenRouter key. Only the local
   profile reads `OPENROUTER_API_KEY`.
2. The browser's one key may be for OpenRouter: the key providers become `openrouter`,
   `gemini` and `anthropic`, still carried by `x-ai-provider` and `x-ai-key`. Every hosted call
   that runs the Judge sends the key, as the Trainer's calls do.
3. An OpenRouter key runs the Judge and the Trainer, which reaches OpenRouter on its own pinned
   primary and fallback models, so one key serves the whole product. A Gemini or Anthropic key
   runs the Trainer only.
4. A hosted call that runs the Judge without an OpenRouter key answers 401 with the code
   `AI_JUDGE_KEY_REQUIRED` and a message that asks for an OpenRouter key in Settings. It answers
   before its rate limit, as a call without a Trainer key does (ADR 0033).
5. In the hosted profile `/settings` offers OpenRouter first and says that Evaluations need it;
   Gemini and Anthropic stay for the Academy's own calls. The local profile is unchanged.

## Consequences

- Hosted visitors pay for their own Evaluations, and the owners pay for none. No free key runs
  the Judge, so Grifando's free Gemini key no longer reaches feedback on writing.
- In the hosted profile the Judge's model is built for each request from its key, as the
  Trainer's is.
- `/settings` departs from Grifando's copy where it names providers, and the privacy page
  (HR-08) states which provider receives what, on whose key.
- #231 lets the browser keep an OpenRouter key and runs the Trainer on it; #232 runs the hosted
  Judge on it. Until #232 merges, the hosted Judge still reads `OPENROUTER_API_KEY`, and a
  hosted deploy must leave it unset.

## Alternatives

- The owners' key runs the hosted Judge: free for visitors, but every public Evaluation would
  cost the owners, which ADR 0012 did not accept and G14 leaves to them.
- A second key for the Judge, in its own header: practice writing runs the Judge and the
  Trainer, so a visitor would need two accounts.
- The Judge on the visitor's Gemini or Anthropic key: rejected by ADR 0012 for calibration
  lineage and free-tier training.
