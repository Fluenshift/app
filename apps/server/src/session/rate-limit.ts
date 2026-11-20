// Ported from Grifando src/server/rateLimit.ts (74dbb9f): fixed-window counters in Postgres, per
// Learner and per hashed client IP, which the hosted profile counts before every state-changing
// route (docs/adr/0033). The cleanup deletes windows older than 2 days (docs/adr/0011).
import { Database } from "@fluenshift/db";
import type { DatabaseError } from "@fluenshift/db";
import { ClientIpConfig } from "@fluenshift/env";
import { Effect, Schema } from "effect";

import type { EdgeFailure } from "../edge";
import { CurrentLearner } from "../learner-identity";

export interface LimitRule {
  readonly max: number;
  readonly name: string;
  readonly windowSeconds: number;
}

// Stub: no rules.
export const RATE_LIMITS = {
  analysis: [],
  generation: [],
  ip: [],
  keyTest: [],
  write: [],
} satisfies Record<string, readonly LimitRule[]>;

/** The limits a route counts a call against; every call also counts against the `ip` ceiling. */
export type RateLimitBucket = Exclude<keyof typeof RATE_LIMITS, "ip">;

// Stub: no message.
export const RATE_LIMIT_MESSAGE = "";

export type ConsumeResult =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly retryAfterSeconds: number };

/** A call the rate limits refuse, with the seconds until the longest of them lifts. */
export class RateLimitedError extends Schema.TaggedError<
  RateLimitedError,
  { readonly brand: unique symbol }
>()("RateLimitedError", { retryAfterSeconds: Schema.Int }) {}

// Stubs: a placeholder answer, a count that refuses with no wait and writes nothing, and a limit
// that never refuses.
export const rateLimited = (_error: RateLimitedError): EdgeFailure => ({
  body: {},
  status: 500,
});

export const consume = Effect.fn("RateLimit.consume")(function* (
  _subject: string,
  _rules: readonly LimitRule[],
  _now: Date = new Date()
): Effect.fn.Return<ConsumeResult, DatabaseError, Database> {
  yield* Database;
  return {
    allowed: false,
    retryAfterSeconds: 0,
  } satisfies ConsumeResult as ConsumeResult;
});

export const limitRequest = Effect.fn("RateLimit.limitRequest")(function* (
  _headers: Headers,
  _bucket: RateLimitBucket
): Effect.fn.Return<
  void,
  DatabaseError | RateLimitedError,
  ClientIpConfig | CurrentLearner | Database
> {
  yield* CurrentLearner;
  yield* ClientIpConfig;
  yield* Database;
});
