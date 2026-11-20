// Ported from Grifando src/server/rateLimit.test.ts (74dbb9f), with the cases of its
// characterization, on a fresh PGlite database per case. consume and limitRequest run through the
// Database service for the Learner "u"; rateLimitResponse is limitRequest answered as the edge
// answers its RateLimitedError: the 429, or null when the call may go on.
import { rm } from "node:fs/promises";

import { LearnerId } from "@fluenshift/contract";
import { Database, rateLimitWindows } from "@fluenshift/db";
import type { DrizzleClient } from "@fluenshift/db";
import { ClientIpConfig } from "@fluenshift/env";
import { asc } from "drizzle-orm";
import { ConfigProvider, Effect, Layer, pipe, Schema } from "effect";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  onTestFinished,
  vi,
} from "vitest";

import type { EdgeFailure } from "../edge";
import { CurrentLearner } from "../learner-identity";
import { makeTemporaryDatabase } from "../test/database";
import { hashedClientIp } from "./client-ip";
import {
  consume,
  limitRequest,
  RATE_LIMIT_MESSAGE,
  RATE_LIMITS,
  rateLimited,
} from "./rate-limit";
import type { LimitRule, RateLimitBucket } from "./rate-limit";

let database: Awaited<ReturnType<typeof makeTemporaryDatabase>>;

beforeEach(async () => {
  database = await makeTemporaryDatabase();
});

afterEach(async () => {
  await rm(database.directory, { force: true, recursive: true });
});

const rule: LimitRule = { max: 3, name: "t", windowSeconds: 60 };
const t0 = new Date("2026-01-01T00:00:10Z");

// The development salt and x-forwarded-for, as Grifando's tests ran.
const clientIp = Effect.runSync(
  Effect.provide(
    ClientIpConfig,
    ClientIpConfig.layer.pipe(
      Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord({})))
    )
  )
);

const run = <A, E>(
  effect: Effect.Effect<A, E, ClientIpConfig | CurrentLearner | Database>
) =>
  Effect.runPromise(
    effect.pipe(
      Effect.provideService(
        CurrentLearner,
        CurrentLearner.of({ id: Schema.decodeSync(LearnerId)("u") })
      ),
      Effect.provideService(ClientIpConfig, ClientIpConfig.of(clientIp)),
      Effect.provide(database.layer)
    )
  );

// The same call, made `times` times in order.
const repeat = <A, E, R>(times: number, effect: Effect.Effect<A, E, R>) =>
  pipe(
    Array.from({ length: times }, () => effect),
    Effect.forEach((each) => each)
  );

const query = <A>(read: (client: DrizzleClient) => Promise<A>) =>
  Effect.runPromise(
    Effect.gen(function* () {
      const store = yield* Database;
      return yield* store.run(read);
    }).pipe(Effect.provide(database.layer))
  );

const responseOf = (failure: EdgeFailure) =>
  Response.json(failure.body, {
    ...(failure.headers === undefined ? {} : { headers: failure.headers }),
    status: failure.status,
  });

const rateLimitResponse = (request: Request, bucket: RateLimitBucket) =>
  limitRequest(request.headers, bucket).pipe(
    Effect.as(null),
    Effect.catchTag("RateLimitedError", (refused) =>
      Effect.succeed(responseOf(rateLimited(refused)))
    )
  );

describe("consume", () => {
  it("allows max calls then blocks with retryAfterSeconds within the window", async () => {
    for (const result of await run(repeat(3, consume("u", [rule], t0)))) {
      expect(result).toEqual({ allowed: true });
    }
    expect(await run(consume("u", [rule], t0))).toEqual({
      allowed: false,
      retryAfterSeconds: 50,
    });
  });

  it("allows again in a new window", async () => {
    await run(repeat(4, consume("u", [rule], t0)));
    const next = new Date(t0.getTime() + 60_000);
    expect(await run(consume("u", [rule], next))).toEqual({ allowed: true });
  });

  it("keeps subjects independent", async () => {
    await run(repeat(4, consume("a", [rule], t0)));
    expect(await run(consume("b", [rule], t0))).toEqual({ allowed: true });
  });

  it("blocks when any rule is exceeded and reports the largest retry", async () => {
    const rules: LimitRule[] = [
      { max: 1, name: "m", windowSeconds: 60 },
      { max: 1, name: "d", windowSeconds: 3600 },
    ];
    await run(consume("u", rules, t0));
    expect(await run(consume("u", rules, t0))).toEqual({
      allowed: false,
      retryAfterSeconds: 3590,
    });
  });
});

describe("rateLimitResponse", () => {
  it("returns 429 with Retry-After once the bucket is exhausted", async () => {
    // Pin the clock mid-window so the 60s bucket can't roll over during the loop.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-01T12:00:10Z"));
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const request = new Request("http://test", {
      headers: { "x-forwarded-for": "203.0.113.9" },
    });
    for (const allowed of await run(
      repeat(5, rateLimitResponse(request, "generation"))
    )) {
      expect(allowed).toBeNull();
    }
    const response = await run(rateLimitResponse(request, "generation"));
    expect(response?.status).toBe(429);
    expect(Number(response?.headers.get("Retry-After"))).toBeGreaterThanOrEqual(
      1
    );
    expect(await response?.json()).toEqual({ error: RATE_LIMIT_MESSAGE });
  });

  it("stores no raw IP", async () => {
    const request = new Request("http://test", {
      headers: { "x-forwarded-for": "203.0.113.9" },
    });
    await run(rateLimitResponse(request, "write"));
    const rows = await query((client) =>
      client.select().from(rateLimitWindows)
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some((r) => r.key.includes("203.0.113.9"))).toBe(false);
  });
});

describe("rate limits", () => {
  it("limits each bucket per minute, hour or day, and tells the visitor to slow down", () => {
    expect(RATE_LIMITS).toEqual({
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
    });
    expect(RATE_LIMIT_MESSAGE).toBe(
      "You're going a bit fast. Wait a moment and try again."
    );
  });

  it("counts every call against the bucket's rules for the user and the client IP's daily ceiling", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-01T12:00:10Z"));
    onTestFinished(() => {
      vi.useRealTimers();
    });
    const request = new Request("http://test", {
      headers: { "x-forwarded-for": "203.0.113.9" },
    });
    await run(rateLimitResponse(request, "analysis"));
    const rows = await query((client) =>
      client.select().from(rateLimitWindows).orderBy(asc(rateLimitWindows.key))
    );
    expect(
      rows.map((row) => [row.key, row.windowStart.toISOString(), row.count])
    ).toEqual([
      ["analysis-day:u", "2026-01-01T00:00:00.000Z", 1],
      ["analysis-min:u", "2026-01-01T12:00:00.000Z", 1],
      [
        `ip-day:${hashedClientIp(request.headers, clientIp)}`,
        "2026-01-01T00:00:00.000Z",
        1,
      ],
    ]);
  });
});
