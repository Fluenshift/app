// Errors the Academy's services share. Ported from Grifando src/server/domain/errors.ts (74dbb9f).
import { Schema } from "effect";

// A record that does not exist or belongs to another Learner: the two read alike, so ids cannot
// be probed. The routes answer it with 404.
export class NotFoundError extends Schema.TaggedError<
  NotFoundError,
  { readonly brand: unique symbol }
>()("NotFoundError", { resource: Schema.String }) {}
