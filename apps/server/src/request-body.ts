// The JSON body of a route: declared to Hono's typed client and checked with a contract schema
// (docs/adr/0042).
import type { StandardSchema } from "effect";

/** `unknown` when the schema checks exactly the declared body, `never` otherwise. */
export type BodyMatch<
  _Checked extends StandardSchema.StandardSchemaV1,
  _Encoded,
  _Decoded,
> = unknown;
