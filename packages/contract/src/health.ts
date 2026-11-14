import { Schema } from "effect";

/** Body of `GET /api/health`. */
export const HealthResponse = Schema.Struct({
  status: Schema.Literal("ok"),
});

export type HealthResponse = typeof HealthResponse.Type;
