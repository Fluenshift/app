// Ported from Grifando src/server/rateLimit.ts (74dbb9f): fixed-window counters in Postgres, per
// Learner and per hashed client IP, which the hosted profile counts before every state-changing
// route (docs/adr/0033). The cleanup deletes windows older than 2 days (docs/adr/0011).
import { Database, rateLimitWindows } from "@fluenshift/db";
import { ClientIpConfig } from "@fluenshift/env";
import { sql } from "drizzle-orm";
import { Effect, pipe, Schema } from "effect";

import type { EdgeFailure } from "../edge";
import { CurrentLearner } from "../learner-identity";
import { hashedClientIp } from "./client-ip";

export interface LimitRule {
  readonly max: number;
  readonly name: string;
  readonly windowSeconds: number;
}

export const RATE_LIMITS = {
  analysis: [
    { max: 10, name: "analysis-min", windowSeconds: 60 },
    { max: 100, name: "analysis-day", windowSeconds: 86_400 },
  ],
  generation: [
    { max: 5, name: "generation-min", windowSeconds: 60 },
    { max: 50, name: "generation-day", windowSeconds: 86_400 },
  ],
  ip: [{ max: 300, name: "ip-day", windowSeconds: 86_400 }],
  keyTest: [{ max: 5, name: "keytest-hour", windowSeconds: 3600 }],
  write: [{ max: 60, name: "write-min", windowSeconds: 60 }],
} satisfies Record<string, readonly LimitRule[]>;

/** The limits a route counts a call against; every call also counts against the `ip` ceiling. */
export type RateLimitBucket = Exclude<keyof typeof RATE_LIMITS, "ip">;

export const RATE_LIMIT_MESSAGE =
  "You're going a bit fast. Wait a moment and try again.";

export type ConsumeResult =
  | { readonly allowed: true }
  | { readonly allowed: false; readonly retryAfterSeconds: number };

/** A call the rate limits refuse, with the seconds until the longest of them lifts. */
export class RateLimitedError extends Schema.TaggedError<
  RateLimitedError,
  { readonly brand: unique symbol }
>()("RateLimitedError", { retryAfterSeconds: Schema.Int }) {}

/** Grifando's 429: its message, and when to try again. */
export const rateLimited = (error: RateLimitedError): EdgeFailure => ({
  body: { error: RATE_LIMIT_MESSAGE },
  headers: { "Retry-After": String(error.retryAfterSeconds) },
  status: 429,
});

/**
 * Increments every rule's counter, so counts stay honest, and blocks when any rule is over its
 * max; with several blocking, the longest wait is reported.
 */
export const consume = Effect.fn("RateLimit.consume")(function* (
  subject: string,
  rules: readonly LimitRule[],
  now: Date = new Date()
) {
  const database = yield* Database;
  const retries = yield* pipe(
    rules,
    Effect.forEach((rule) => {
      const windowMilliseconds = rule.windowSeconds * 1000;
      const startMilliseconds =
        Math.floor(now.getTime() / windowMilliseconds) * windowMilliseconds;
      return database
        .run((client) =>
          client
            .insert(rateLimitWindows)
            .values({
              count: 1,
              key: `${rule.name}:${subject}`,
              windowStart: new Date(startMilliseconds),
            })
            .onConflictDoUpdate({
              set: { count: sql`${rateLimitWindows.count} + 1` },
              target: [rateLimitWindows.key, rateLimitWindows.windowStart],
            })
            .returning({ count: rateLimitWindows.count })
        )
        .pipe(
          Effect.map(([row]) =>
            row !== undefined && row.count > rule.max
              ? Math.max(
                  1,
                  Math.ceil(
                    (startMilliseconds + windowMilliseconds - now.getTime()) /
                      1000
                  )
                )
              : 0
          )
        );
    })
  );
  const retryAfterSeconds = Math.max(0, ...retries);
  return (
    retryAfterSeconds > 0
      ? { allowed: false, retryAfterSeconds }
      : { allowed: true }
  ) satisfies ConsumeResult;
});

/**
 * Counts a call of the current Learner against its route's bucket, and of the hashed client IP
 * against the per-IP ceiling, as Grifando's rateLimitResponse did, and fails with the longest
 * wait when either refuses it.
 */
export const limitRequest = Effect.fn("RateLimit.limitRequest")(function* (
  headers: Headers,
  bucket: RateLimitBucket
) {
  const learner = yield* CurrentLearner;
  const clientIp = yield* ClientIpConfig;
  const results = [
    yield* consume(learner.id, RATE_LIMITS[bucket]),
    yield* consume(hashedClientIp(headers, clientIp), RATE_LIMITS.ip),
  ];
  const retryAfterSeconds = Math.max(
    0,
    ...results.map((result) => (result.allowed ? 0 : result.retryAfterSeconds))
  );
  if (retryAfterSeconds > 0) {
    return yield* new RateLimitedError({ retryAfterSeconds });
  }
});
