// The JSON body of a route, declared to Hono's typed client and checked with a contract schema
// (docs/adr/0042): the client sends the schema's encoded side, and the route reads its decoded
// side.
import type { Schema, StandardSchema } from "effect";
import type { Context } from "hono";
import type { BlankEnv } from "hono/types";

interface JsonBody<Encoded, Decoded> {
  in: { json: Encoded };
  out: { json: Decoded };
}

/** The context of a route whose JSON body the contract schema `S` checks. */
export type BodyContext<S extends Schema.Top, Path extends string> = Context<
  BlankEnv,
  Path,
  JsonBody<S["Encoded"], S["Type"]>
>;

// `true` only when A and B are one type: a subtype or a supertype of A is another type.
type Same<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;

/** `unknown` when the schema checks exactly the declared body, `never` otherwise. */
export type BodyMatch<
  Checked extends StandardSchema.StandardSchemaV1,
  Encoded,
  Decoded,
> =
  Same<
    StandardSchema.StandardSchemaV1.InferInput<Checked>,
    Encoded
  > extends true
    ? Same<
        StandardSchema.StandardSchemaV1.InferOutput<Checked>,
        Decoded
      > extends true
      ? unknown
      : never
    : never;

/**
 * Reads a route's JSON body and checks it with the standard form of a contract schema, which must
 * check exactly the body the route's context declares to the typed client, or `tsc` fails. Each
 * route reads its body after its own first checks and chooses what a body that is not JSON reads
 * as, keeping its source's answers.
 */
export const readBody = <Input, Output, Encoded, Decoded, Path extends string>(
  context: Context<BlankEnv, Path, JsonBody<Encoded, Decoded>>,
  schema: StandardSchema.StandardSchemaV1<Input, Output> &
    BodyMatch<StandardSchema.StandardSchemaV1<Input, Output>, Encoded, Decoded>,
  notJson: unknown
) =>
  context.req
    .json<unknown>()
    .catch(() => notJson)
    .then((body) => schema["~standard"].validate(body));
