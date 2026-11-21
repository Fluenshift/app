// A route's body schema must check exactly the body its context declares to the typed client: one
// key more or one key less fails `tsc` (docs/adr/0042). The assertions are types: Vitest runs
// nothing here.
import { AttemptRequest } from "@fluenshift/contract";
import type { AttemptRequest as Read } from "@fluenshift/contract";
import { Schema } from "effect";
import { describe, expectTypeOf, it } from "vitest";

import type { BodyMatch } from "./request-body";

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

type Declared = typeof AttemptRequest.Encoded;

describe("a route's body schema", () => {
  it("matches the body its context declares", () => {
    expectTypeOf<
      BodyMatch<typeof exact, Declared, Read>
    >().toEqualTypeOf<unknown>();
  });

  it("does not match a body with one key more or one key less", () => {
    expectTypeOf<
      BodyMatch<typeof oneKeyMore, Declared, Read>
    >().toEqualTypeOf<never>();
    expectTypeOf<
      BodyMatch<typeof oneKeyLess, Declared, Read>
    >().toEqualTypeOf<never>();
    expectTypeOf<
      BodyMatch<typeof optionalKeyMore, Declared, Read>
    >().toEqualTypeOf<never>();
  });
});
