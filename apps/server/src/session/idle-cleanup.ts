// Ported from Grifando src/server/domain/privacy/cleanup.ts (74dbb9f): the hosted profile deletes
// every Learner idle for 90 days, with all their data, and the rate-limit windows older than 2 days.
// Grifando's Vercel cron called it daily at 03:17 UTC through a secret-protected route; the server
// runs it in process at the same hour, with no route (docs/adr/0011).
import { Database, learners, rateLimitWindows } from "@fluenshift/db";
import { lt } from "drizzle-orm";
import { Clock, Effect, Layer, Schedule } from "effect";

import { nameOf } from "../edge";

const DAY_MILLISECONDS = 24 * 60 * 60 * 1000;
export const IDLE_DAYS = 90;
const WINDOW_RETENTION_DAYS = 2;

/** Deletes idle Learners, whose rows cascade to all their data, and old rate-limit windows. */
export const cleanupIdleData = Effect.fn("IdleCleanup.cleanupIdleData")(
  function* (now: Date) {
    const database = yield* Database;
    const deletedLearners = yield* database.run((client) =>
      client
        .delete(learners)
        .where(
          lt(
            learners.lastActiveAt,
            new Date(now.getTime() - IDLE_DAYS * DAY_MILLISECONDS)
          )
        )
        .returning({ id: learners.id })
    );
    const deletedWindows = yield* database.run((client) =>
      client
        .delete(rateLimitWindows)
        .where(
          lt(
            rateLimitWindows.windowStart,
            new Date(now.getTime() - WINDOW_RETENTION_DAYS * DAY_MILLISECONDS)
          )
        )
        .returning({ key: rateLimitWindows.key })
    );
    return {
      learners: deletedLearners.length,
      windows: deletedWindows.length,
    };
  }
);

/**
 * Runs `task` every day at 03:17 UTC, the hour of Grifando's cron. A failed run logs its tag or
 * name, never its message, and waits for the next day, so one failure never stops the schedule.
 */
export const daily = Effect.fn("IdleCleanup.daily")(function* <A, E, R>(
  task: Effect.Effect<A, E, R>
) {
  return yield* task.pipe(
    Effect.catchCause((cause) =>
      Effect.logError("idle-cleanup failed").pipe(
        Effect.annotateLogs({ error: nameOf(cause) })
      )
    ),
    Effect.schedule(Schedule.cron("17 3 * * *", "UTC"))
  );
});

/** The cleanup of each day, with its counts in the log, at the clock's time. */
export const cleanupToday = Effect.gen(function* () {
  const now = new Date(yield* Clock.currentTimeMillis);
  const deleted = yield* cleanupIdleData(now);
  yield* Effect.logInfo("idle-cleanup").pipe(Effect.annotateLogs(deleted));
});

/** The hosted profile's daily cleanup, forked for as long as the server runs. */
export const IdleCleanup = Layer.effectDiscard(
  Effect.forkScoped(daily(cleanupToday))
);
