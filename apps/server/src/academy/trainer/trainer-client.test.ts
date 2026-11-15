// Re-expressed from the characterization of Grifando src/server/ai/client.ts (74dbb9f),
// migration/characterization/grifando/files/src/server/ai/client.characterization.test.ts.
// Grifando read the model a client was built with, and faked each SDK's key test. Here the
// AI SDK's Anthropic and Google providers run over a fake fetch, so each case reads the model
// that every request named, as the provider received it. The model pins live in Trainer
// Config (docs/adr/0012), and an answer names the model that gave it (Grifando #77).
import { ConfigProvider, Effect, Fiber, Layer, Redacted } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, it } from "vitest";

import { TrainerClient } from "./trainer-client";
import type { TrainerCredentials } from "./trainer-client";

type ProviderFetch = typeof globalThis.fetch;

// A request as a provider received it: the model it named and the key it carried.
interface ProviderRequest {
  readonly key: string | null;
  readonly model: string;
  readonly provider: TrainerCredentials["provider"];
}

const GEMINI_MODEL = /\/models\/(?<model>[^/:]+):generateContent$/u;

// Gemini names the model in the path; Anthropic names it in the body.
const readRequest = async (
  input: Parameters<ProviderFetch>[0],
  init: Parameters<ProviderFetch>[1]
): Promise<ProviderRequest> => {
  const request = new Request(input, init);
  const geminiModel = GEMINI_MODEL.exec(new URL(request.url).pathname)
    ?.groups?.["model"];
  if (geminiModel !== undefined) {
    return {
      key: request.headers.get("x-goog-api-key"),
      model: geminiModel,
      provider: "gemini",
    };
  }
  const body = (await request.json()) as { readonly model?: unknown };
  return {
    key: request.headers.get("x-api-key"),
    model: String(body.model),
    provider: "anthropic",
  };
};

const question = { question: "Tell me about a project you're proud of." };

// The answer each API gives to a call it accepts.
const answered = ({ model, provider }: ProviderRequest) =>
  provider === "gemini"
    ? Response.json({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify(question) }],
              role: "model",
            },
            finishReason: "STOP",
            index: 0,
          },
        ],
        usageMetadata: {
          candidatesTokenCount: 1,
          promptTokenCount: 1,
          totalTokenCount: 2,
        },
      })
    : Response.json({
        content: [{ text: JSON.stringify(question), type: "text" }],
        id: "msg_test",
        model,
        role: "assistant",
        stop_reason: "end_turn",
        stop_sequence: null,
        type: "message",
        usage: { input_tokens: 1, output_tokens: 1 },
      });

// The error each API answers with, in its own envelope: Gemini names a status beside the
// HTTP code, Anthropic an error type.
const GEMINI_STATUS: Readonly<Record<number, string>> = {
  400: "INVALID_ARGUMENT",
  404: "NOT_FOUND",
  429: "RESOURCE_EXHAUSTED",
  503: "UNAVAILABLE",
};
const ANTHROPIC_ERROR: Readonly<Record<number, string>> = {
  401: "authentication_error",
  404: "not_found_error",
  429: "rate_limit_error",
  503: "api_error",
  529: "overloaded_error",
};

const refused = (
  { provider }: ProviderRequest,
  status: number,
  message: string
) =>
  provider === "gemini"
    ? Response.json(
        { error: { code: status, message, status: GEMINI_STATUS[status] } },
        { status }
      )
    : Response.json(
        {
          error: { message, type: ANTHROPIC_ERROR[status] },
          type: "error",
        },
        { status }
      );

const overloaded = (request: ProviderRequest) =>
  refused(request, request.provider === "gemini" ? 503 : 529, "Overloaded");

// Like fetch for a provider that never answers: it rejects once its request is aborted.
const unanswered = (signal: AbortSignal | null | undefined) => {
  const answer = Promise.withResolvers<Response>();
  signal?.addEventListener("abort", () => {
    answer.reject(new DOMException("The request was aborted.", "AbortError"));
  });
  return answer.promise;
};

const fakeProviders = (
  answer: (request: ProviderRequest) => Response = answered
) => {
  const requests: ProviderRequest[] = [];
  const providerFetch: ProviderFetch = async (input, init) => {
    const request = await readRequest(input, init);
    requests.push(request);
    return answer(request);
  };
  return { providerFetch, requests };
};

const credentials = (
  provider: TrainerCredentials["provider"]
): TrainerCredentials => ({ apiKey: Redacted.make("test-key"), provider });

const withClient = <A, E>(
  env: Record<string, string>,
  providerFetch: ProviderFetch,
  use: (client: TrainerClient["Service"]) => Effect.Effect<A, E>
) =>
  Effect.runPromise(
    Effect.gen(function* () {
      return yield* use(yield* TrainerClient);
    }).pipe(
      Effect.provide(
        TrainerClient.layerWith(providerFetch).pipe(
          Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord(env)))
        )
      )
    )
  );

// One Trainer call for each provider, Gemini first.
const askBoth = (env: Record<string, string>, providerFetch: ProviderFetch) =>
  withClient(env, providerFetch, (client) =>
    Effect.all([
      client.trainerFor(credentials("gemini")).continueInterview([]),
      client.trainerFor(credentials("anthropic")).continueInterview([]),
    ])
  );

const testBoth = (env: Record<string, string>, providerFetch: ProviderFetch) =>
  withClient(env, providerFetch, (client) =>
    Effect.all([
      client.testKey(credentials("gemini")),
      client.testKey(credentials("anthropic")),
    ])
  );

const modelsOf = (
  requests: readonly ProviderRequest[],
  provider: TrainerCredentials["provider"]
) =>
  requests
    .filter((request) => request.provider === provider)
    .map(({ model }) => model);

const namedModels = {
  ANTHROPIC_MODEL: "claude-opus-5",
  GEMINI_MODEL: "gemini-3.8-flash",
};

describe("AI client model choice", () => {
  it("answers with gemini-3.5-flash and claude-sonnet-5 unless the environment names a model", async () => {
    const pinned = fakeProviders();
    const named = fakeProviders();

    const [gemini, anthropic] = await askBoth({}, pinned.providerFetch);
    await askBoth(namedModels, named.providerFetch);

    expect(gemini.model).toBe("gemini-3.5-flash");
    expect(anthropic.model).toBe("claude-sonnet-5");
    // Each call is one request, to the provider's model, with the Learner's key.
    expect(pinned.requests).toStrictEqual([
      { key: "test-key", model: "gemini-3.5-flash", provider: "gemini" },
      { key: "test-key", model: "claude-sonnet-5", provider: "anthropic" },
    ]);
    expect(named.requests.map(({ model }) => model)).toStrictEqual([
      "gemini-3.8-flash",
      "claude-opus-5",
    ]);
  });

  it("falls back to gemini-3.5-flash-lite and claude-haiku-5-5", async () => {
    const primaries = new Set(["claude-sonnet-5", "gemini-3.5-flash"]);
    const providers = fakeProviders((request) =>
      primaries.has(request.model) ? overloaded(request) : answered(request)
    );

    const [gemini, anthropic] = await askBoth({}, providers.providerFetch);

    // The answer names the fallback model that gave it (Grifando #77).
    expect(gemini.model).toBe("gemini-3.5-flash-lite");
    expect(anthropic.model).toBe("claude-haiku-5-5");
    expect(providers.requests.map(({ model }) => model)).toStrictEqual([
      "gemini-3.5-flash",
      "gemini-3.5-flash-lite",
      "claude-sonnet-5",
      "claude-haiku-5-5",
    ]);
  });

  it("gives the primary model 60 seconds before the fallback answers", async () => {
    const requested: string[] = [];
    const called = Promise.withResolvers<boolean>();
    const providerFetch: ProviderFetch = async (input, init) => {
      const request = await readRequest(input, init);
      requested.push(request.model);
      if (request.model !== "claude-sonnet-5") {
        return answered(request);
      }
      called.resolve(true);
      return unanswered(init?.signal);
    };

    const outcome = await withClient({}, providerFetch, (client) =>
      Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(
          client.trainerFor(credentials("anthropic")).continueInterview([])
        );
        yield* Effect.promise(() => called.promise);
        yield* TestClock.adjust("59 seconds");
        const before = [...requested];
        yield* TestClock.adjust("1 second");
        return { answer: yield* Fiber.join(fiber), before };
      }).pipe(Effect.provide(TestClock.layer()))
    );

    expect(outcome.before).toStrictEqual(["claude-sonnet-5"]);
    expect(outcome.answer.model).toBe("claude-haiku-5-5");
    expect(requested).toStrictEqual(["claude-sonnet-5", "claude-haiku-5-5"]);
  });

  it("tests a key on the light fallback model, not the primary one", async () => {
    const providers = fakeProviders();

    const [gemini, anthropic] = await testBoth(
      namedModels,
      providers.providerFetch
    );

    expect(gemini).toBe("works");
    expect(anthropic).toBe("works");
    expect(modelsOf(providers.requests, "gemini")).toEqual([
      "gemini-3.5-flash-lite",
    ]);
    expect(modelsOf(providers.requests, "anthropic")).toEqual([
      "claude-haiku-5-5",
    ]);
  });
});

// Grifando's testAIKey answers a status, which its key test route returns: rejected keys read
// as invalid; quota, overload, silence and anything unexpected read as busy, because the key
// may still be fine.
describe("AI client key test", () => {
  it("reads a key the provider rejects as invalid", async () => {
    const providers = fakeProviders((request) =>
      request.provider === "gemini"
        ? refused(
            request,
            400,
            "API key not valid. Please pass a valid API key."
          )
        : refused(request, 401, "invalid x-api-key")
    );

    expect(await testBoth({}, providers.providerFetch)).toStrictEqual([
      "invalid",
      "invalid",
    ]);
  });

  it("reads exhausted quota, overload and anything unexpected as busy, asking each provider once", async () => {
    const runs = await Promise.all(
      [429, 503, 404].map(async (status) => {
        const providers = fakeProviders((request) =>
          refused(request, status, "Refused")
        );
        const statuses = await testBoth({}, providers.providerFetch);
        return { requests: providers.requests.length, statuses };
      })
    );

    expect(runs).toStrictEqual([
      { requests: 2, statuses: ["busy", "busy"] },
      { requests: 2, statuses: ["busy", "busy"] },
      { requests: 2, statuses: ["busy", "busy"] },
    ]);
  });

  it("reads a provider that does not answer in 15 seconds as busy, and stops waiting", async () => {
    const called = Promise.withResolvers<AbortSignal | null | undefined>();
    const silent: ProviderFetch = (_input, init) => {
      called.resolve(init?.signal);
      return unanswered(init?.signal);
    };

    const status = await withClient({}, silent, (client) =>
      Effect.gen(function* () {
        const fiber = yield* Effect.forkChild(
          client.testKey(credentials("gemini"))
        );
        const signal = yield* Effect.promise(() => called.promise);
        yield* TestClock.adjust("14 seconds");
        const abortedEarly = signal?.aborted;
        yield* TestClock.adjust("1 second");
        return {
          aborted: signal?.aborted,
          abortedEarly,
          status: yield* Fiber.join(fiber),
        };
      }).pipe(Effect.provide(TestClock.layer()))
    );

    expect(status).toStrictEqual({
      aborted: true,
      abortedEarly: false,
      status: "busy",
    });
  });
});
