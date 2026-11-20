import { Context, Effect, Layer, Logger, ManagedRuntime, Schema } from "effect";
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

  it("answers a defect with the route's own body when the route gives one", async () => {
    const edge = makeEdge(ManagedRuntime.make(greeter));
    const response = await new Hono()
      .get("/greet/:name", (context) =>
        edge(
          Greeter.pipe(
            Effect.flatMap((service) =>
              service.greet(context.req.param("name"))
            )
          ),
          {
            errors,
            success: (greeting) => Response.json({ greeting }),
            unexpected: {
              body: { error: "Something went wrong." },
              status: 500,
            },
          }
        )
      )
      .request("/greet/defect");
    const text = await response.text();

    expect(response.status).toBe(500);
    expect(JSON.parse(text)).toStrictEqual({ error: "Something went wrong." });
    expect(text).not.toContain("private-cause");
  });

  it("logs an unexpected failure once, with the route's context and the error's name only", async () => {
    const lines: unknown[] = [];
    const keepLogs = Logger.layer([
      Logger.make((options) => {
        lines.push(Logger.formatStructured.log(options));
      }),
    ]);
    const edge = makeEdge(
      ManagedRuntime.make(Layer.mergeAll(greeter, keepLogs))
    );
    const route = new Hono().get("/greet/:name", (context) =>
      edge(
        Greeter.use((service) => service.greet(context.req.param("name"))),
        {
          errors,
          log: "Failed to greet",
          success: (greeting) => Response.json({ greeting }),
        }
      )
    );

    const failed = await route.request("/greet/defect");
    const missing = await route.request("/greet/missing");

    expect([failed.status, missing.status]).toEqual([500, 404]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      annotations: { error: "Error" },
      level: "ERROR",
      message: "Failed to greet",
    });
    expect(JSON.stringify(lines)).not.toContain("private-cause");
  });

  it("logs a tagged failure the route answers with a 500, and not one it answers otherwise", async () => {
    const lines: unknown[] = [];
    const keepLogs = Logger.layer([
      Logger.make((options) => {
        lines.push(Logger.formatStructured.log(options));
      }),
    ]);
    const edge = makeEdge(
      ManagedRuntime.make(Layer.mergeAll(greeter, keepLogs))
    );
    const route = new Hono().get("/greet/:name", (context) =>
      edge(
        Greeter.use((service) => service.greet(context.req.param("name"))),
        {
          errors: {
            NotFound: () => ({
              body: { error: "Something went wrong." },
              status: 500,
            }),
            Unavailable: errors.Unavailable,
          },
          log: "Failed to greet",
          success: (greeting) => Response.json({ greeting }),
        }
      )
    );

    const failed = await route.request("/greet/missing");
    const busy = await route.request("/greet/busy");

    expect([failed.status, busy.status]).toEqual([500, 503]);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      annotations: { error: "NotFound" },
      level: "ERROR",
      message: "Failed to greet",
    });
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
