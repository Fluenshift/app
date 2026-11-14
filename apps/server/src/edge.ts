import { Cause, Exit, Option } from "effect";
import type { Effect, ManagedRuntime } from "effect";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { JSONValue } from "hono/utils/types";

/** What every `Schema.TaggedError` is: the edge tells errors apart by their tag. */
export interface Tagged {
  readonly _tag: string;
}

export interface EdgeFailure {
  readonly status: ContentfulStatusCode;
  readonly body: Readonly<Record<string, JSONValue>>;
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
  errors: EdgeErrors<E>
): EdgeFailure => {
  const failure = Option.getOrUndefined(Cause.findErrorOption(cause));
  if (!isTagged(failure) || !Object.hasOwn(errors, failure._tag)) {
    return INTERNAL_ERROR;
  }
  const respond = errors[failure._tag as E["_tag"]];
  return respond(failure as never);
};

/**
 * The only way a route answers from an Effect. It runs the Effect in the application runtime,
 * answers a success through `success`, a tagged error through its entry in `errors`, and
 * anything else with `INTERNAL_ERROR`, which carries no cause.
 */
export const makeEdge =
  <R, ER>(runtime: ManagedRuntime.ManagedRuntime<R, ER>) =>
  <A, E extends Tagged>(
    effect: Effect.Effect<A, E, R>,
    handlers: {
      readonly errors: EdgeErrors<E>;
      readonly success: (value: A) => Response | Promise<Response>;
    }
  ): Promise<Response> =>
    runtime.runPromiseExit(effect).then((exit) => {
      if (Exit.isSuccess(exit)) {
        return handlers.success(exit.value);
      }
      const failure = failureOf(exit.cause, handlers.errors);
      return Response.json(failure.body, { status: failure.status });
    });
