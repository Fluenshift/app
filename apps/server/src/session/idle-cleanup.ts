// Ported from Grifando src/server/domain/privacy/cleanup.ts (74dbb9f): the hosted profile deletes
// every Learner idle for 90 days, with all their data, and the rate-limit windows older than 2 days.
// Grifando's Vercel cron called it daily at 03:17 UTC through a secret-protected route; the server
// runs it in process at the same hour, with no route (docs/adr/0011).
import { Database } from "@fluenshift/db";
import { Clock, Effect, Layer } from "effect";

export const IDLE_DAYS = 90;

// Stubs: a cleanup that deletes nothing, and a schedule that never runs its task.
export const cleanupIdleData = Effect.fn("IdleCleanup.cleanupIdleData")(
  function* (_now: Date) {
    yield* Database;
    return { learners: -1, windows: -1 };
  }
);

export const daily = <A, E, R>(
  _task: Effect.Effect<A, E, R>
): Effect.Effect<void, never, R> => Effect.void;

export const cleanupToday = Effect.gen(function* () {
  const now = new Date(yield* Clock.currentTimeMillis);
  yield* cleanupIdleData(now);
});

export const IdleCleanup = Layer.effectDiscard(
  Effect.forkScoped(daily(cleanupToday))
);
