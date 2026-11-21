// A route's body schema must check exactly the body its context declares to the typed client: one
// key more or one key less fails `tsc` (docs/adr/0042). The assertions are types: Vitest runs
// nothing here.
import { AttemptRequest } from "@fluenshift/contract";
import type { AttemptRequest as Decoded } from "@fluenshift/contract";
import { Schema } from "effect";
import type { StandardSchema } from "effect";
import { describe, expectTypeOf, it } from "vitest";

import type { BodyMatch, readBody } from "./request-body";

const exact = Schema.toStandardSchemaV1(AttemptRequest);
const oneKeyMore = Schema.toStandardSchemaV1(
  Schema.Struct({ ...AttemptRequest.fields, reason: Schema.String })
);
const oneKeyLess = Schema.toStandardSchemaV1(Schema.Struct({}));
const optionalKeyMore = Schema.toStandardSchemaV1(
  Schema.Struct({
    ...AttemptRequest.fields,
    reason: Schema.optionalKey(Schema.String),
  })
);

type Encoded = typeof AttemptRequest.Encoded;

// The schema that `readBody` accepts on a route whose context declares AttemptRequest's body.
type SchemaParameter<Checked extends StandardSchema.StandardSchemaV1> =
  Parameters<
    typeof readBody<
      StandardSchema.StandardSchemaV1.InferInput<Checked>,
      StandardSchema.StandardSchemaV1.InferOutput<Checked>,
      Encoded,
      Decoded,
      "/api/attempts"
    >
  >[1];

describe("a route's body schema", () => {
  it("matches the body its context declares", () => {
    expectTypeOf<
      BodyMatch<typeof exact, Encoded, Decoded>
    >().toEqualTypeOf<unknown>();
  });

  it("does not match a body with one key more or one key less", () => {
    expectTypeOf<
      BodyMatch<typeof oneKeyMore, Encoded, Decoded>
    >().toEqualTypeOf<never>();
    expectTypeOf<
      BodyMatch<typeof oneKeyLess, Encoded, Decoded>
    >().toEqualTypeOf<never>();
    expectTypeOf<
      BodyMatch<typeof optionalKeyMore, Encoded, Decoded>
    >().toEqualTypeOf<never>();
  });

  it("is what readBody accepts, and readBody accepts no other", () => {
    expectTypeOf<typeof exact>().toExtend<SchemaParameter<typeof exact>>();
    expectTypeOf<SchemaParameter<typeof oneKeyMore>>().toBeNever();
    expectTypeOf<SchemaParameter<typeof oneKeyLess>>().toBeNever();
    expectTypeOf<SchemaParameter<typeof optionalKeyMore>>().toBeNever();
  });
});
