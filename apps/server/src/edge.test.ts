import { Context, Effect, Layer, ManagedRuntime, Schema } from "effect";
import { Hono } from "hono";
import { describe, expect, expectTypeOf, it } from "vitest";

import { INTERNAL_ERROR, makeEdge } from "./edge";
import type { EdgeErrors } from "./edge";

class NotFound extends Schema.TaggedError<
  NotFound,
  { readonly brand: unique symbol }
>()("NotFound", {
  id: Schema.String,
}) {}

class Unavailable extends Schema.TaggedError<
  Unavailable,
  { readonly brand: unique symbol }
>()("Unavailable", {
  retryable: Schema.Boolean,
}) {}

class Greeter extends Context.Service<
  Greeter,
  { greet(name: string): Effect.Effect<string, NotFound | Unavailable> }
>()("server/edge.test/Greeter") {}

const greeter = Layer.succeed(
  Greeter,
  Greeter.of({
    greet: (name) => {
      if (name === "missing") {
        return Effect.fail(new NotFound({ id: name }));
      }
      if (name === "busy") {
        return Effect.fail(new Unavailable({ retryable: true }));
      }
      if (name === "defect") {
        return Effect.die(new Error("private-cause"));
      }
      if (name === "interrupted") {
        return Effect.interrupt;
      }
      return Effect.succeed(`hello ${name}`);
    },
  })
);

const errors = {
  NotFound: (error) => ({
    body: { code: "not-found", error: `No greeting for ${error.id}` },
    status: 404,
  }),
  Unavailable: (error) => ({
    body: { code: "unavailable", retryable: error.retryable },
    status: 503,
  }),
} satisfies EdgeErrors<NotFound | Unavailable>;

const app = () => {
  const edge = makeEdge(ManagedRuntime.make(greeter));
  return new Hono().get("/greet/:name", (context) =>
    edge(
      Greeter.use((service) => service.greet(context.req.param("name"))),
      {
        errors,
        success: (greeting) => context.json({ greeting }, 201),
      }
    )
  );
};

describe("Effect edge", () => {
  it("answers a successful Effect through the success handler, with the runtime's services", async () => {
    const response = await app().request("/greet/ada");

    expect(response.status).toBe(201);
    expect(await response.json()).toStrictEqual({ greeting: "hello ada" });
  });

  it("answers NotFound with its status and body", async () => {
    const response = await app().request("/greet/missing");

    expect(response.status).toBe(404);
    expect(await response.json()).toStrictEqual({
      code: "not-found",
      error: "No greeting for missing",
    });
  });

  it("answers Unavailable with its status and body", async () => {
    const response = await app().request("/greet/busy");

    expect(response.status).toBe(503);
    expect(await response.json()).toStrictEqual({
      code: "unavailable",
      retryable: true,
    });
  });

  it("answers a defect with a safe internal error", async () => {
    const response = await app().request("/greet/defect");
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(JSON.parse(text)).toStrictEqual({
      code: "internal-error",
      error: "Request could not be completed",
    });
    expect(text).not.toContain("private-cause");
  });

  it("answers an interrupted Effect with a safe internal error", async () => {
    const response = await app().request("/greet/interrupted");

    expect(response.status).toBe(500);
    expect(await response.json()).toStrictEqual(INTERNAL_ERROR.body);
  });

  it("requires an entry for every tagged error of the Effect", () => {
    expectTypeOf<keyof EdgeErrors<NotFound | Unavailable>>().toEqualTypeOf<
      "NotFound" | "Unavailable"
    >();
    expectTypeOf<keyof EdgeErrors<never>>().toEqualTypeOf<never>();
  });
});
