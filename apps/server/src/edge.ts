import { Cause, Effect, Exit, Option } from "effect";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { JSONValue } from "hono/utils/types";

/** What every `Schema.TaggedError` is: the edge tells errors apart by their tag. */
export interface Tagged {
  readonly _tag: string;
}

export interface EdgeFailure {
  readonly status: ContentfulStatusCode;
  readonly body: Readonly<Record<string, JSONValue>>;
  /** Headers the answer carries besides its JSON body, such as a 429's `Retry-After`. */
  readonly headers?: Readonly<Record<string, string>>;
}

/**
 * One entry per tagged error an Effect can fail with: its status and its public body. A route
 * whose Effect gains a tagged error does not compile until the error has an entry here.
 */
export type EdgeErrors<E extends Tagged> = {
  readonly [Tag in E["_tag"]]: (
    error: Extract<E, { readonly _tag: Tag }>
  ) => EdgeFailure;
};

/**
 * What runs a route's Effect to its exit: the application's `ManagedRuntime`, or the services of
 * the running server through `Effect.runPromiseExitWith`.
 */
export interface EdgeRuntime<R> {
  readonly runPromiseExit: <A, E>(
    effect: Effect.Effect<A, E, R>
  ) => Promise<Exit.Exit<A, unknown>>;
}

/** The answer to anything unexpected: a defect, an interruption, a failed layer. */
export const INTERNAL_ERROR: EdgeFailure = {
  body: { code: "internal-error", error: "Request could not be completed" },
  status: 500,
};

const isTagged = (value: unknown): value is Tagged =>
  typeof value === "object" &&
  value !== null &&
  "_tag" in value &&
  typeof value._tag === "string";

// Each entry takes its own error class, so the entry found by tag is called with the failure
// of that tag; `never` is the only parameter type every entry accepts.
const failureOf = <E extends Tagged>(
  cause: Cause.Cause<unknown>,
  errors: EdgeErrors<E>,
  unexpected: EdgeFailure
): EdgeFailure => {
  const failure = Option.getOrUndefined(Cause.findErrorOption(cause));
  if (!isTagged(failure) || !Object.hasOwn(errors, failure._tag)) {
    return unexpected;
  }
  const respond = errors[failure._tag as E["_tag"]];
  return respond(failure as never);
};

// What a log line may say about an unexpected failure: a tagged error's tag or a thrown value's
// name, never its message or other properties, which can carry a request's key or Learner text
// (docs/adr/0026).
const nameOf = (cause: Cause.Cause<unknown>): string => {
  const failure = Cause.squash(cause);
  if (isTagged(failure)) {
    return failure._tag;
  }
  return failure instanceof Error ? failure.name : "NonErrorThrown";
};

/**
 * The only way a route answers from an Effect. It runs the Effect in the application runtime,
 * answers a success through `success`, a tagged error through its entry in `errors`, and
 * anything else with `INTERNAL_ERROR`, which carries no cause.
 */
export const makeEdge =
  <R>(runtime: EdgeRuntime<R>) =>
  <A, E extends Tagged>(
    effect: Effect.Effect<A, E, R>,
    handlers: {
      readonly errors: EdgeErrors<E>;
      readonly success: (value: A) => Response | Promise<Response>;
      /**
       * The context of the one error-level line each generic 500 logs, with the error's tag or
       * name only (docs/adr/0026). A route without one logs nothing.
       */
      readonly log?: string;
      /** The answer to anything unexpected, when a route keeps its source's; `INTERNAL_ERROR` otherwise. */
      readonly unexpected?: EdgeFailure;
    }
  ): Promise<Response> => {
    const unexpected = handlers.unexpected ?? INTERNAL_ERROR;
    const { log: context } = handlers;
    // A route that names a log context logs each generic 500 it answers, through an entry or
    // through `unexpected`, as Grifando logged before each one (docs/adr/0026).
    const logged =
      context === undefined
        ? effect
        : effect.pipe(
            Effect.tapCause((cause) =>
              failureOf(cause, handlers.errors, unexpected).status === 500
                ? Effect.logError(context).pipe(
                    Effect.annotateLogs({ error: nameOf(cause) })
                  )
                : Effect.void
            )
          );
    return runtime.runPromiseExit(logged).then((exit) => {
      if (Exit.isSuccess(exit)) {
        return handlers.success(exit.value);
      }
      const failure = failureOf(exit.cause, handlers.errors, unexpected);
      return Response.json(failure.body, {
        ...(failure.headers === undefined ? {} : { headers: failure.headers }),
        status: failure.status,
      });
    });
  };
