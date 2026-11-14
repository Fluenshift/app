// Typed stub for the red commit: every request answers 501, so no check passes yet.
import type { Effect, ManagedRuntime } from "effect";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { JSONValue } from "hono/utils/types";

export interface Tagged {
  readonly _tag: string;
}

export interface EdgeFailure {
  readonly status: ContentfulStatusCode;
  readonly body: Readonly<Record<string, JSONValue>>;
}

export type EdgeErrors<E extends Tagged> = {
  readonly [Tag in E["_tag"]]: (
    error: Extract<E, { readonly _tag: Tag }>
  ) => EdgeFailure;
};

export const INTERNAL_ERROR: EdgeFailure = { body: {}, status: 501 };

export const makeEdge =
  <R, ER>(_runtime: ManagedRuntime.ManagedRuntime<R, ER>) =>
  <A, E extends Tagged>(
    _effect: Effect.Effect<A, E, R>,
    _handlers: {
      readonly errors: EdgeErrors<E>;
      readonly success: (value: A) => Response | Promise<Response>;
    }
  ): Promise<Response> =>
    Promise.resolve(Response.json({}, { status: 501 }));
