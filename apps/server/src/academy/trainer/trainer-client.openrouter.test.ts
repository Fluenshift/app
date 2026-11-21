// The Trainer on a visitor's OpenRouter key (docs/adr/0035): Gemini's pinned models through
// OpenRouter, the same fallback on overload, the key test on the light model, and OpenRouter's
// own failures read as the Trainer's access errors. The AI SDK's OpenRouter provider runs over a
// fake fetch, so each case reads what every request carried, as OpenRouter received it.
import { ConfigProvider, Effect, Layer, Redacted } from "effect";
import { describe, expect, it } from "vitest";

import { TrainerClient } from "./trainer-client";
import type { TrainerCredentials } from "./trainer-client";
import { enrichmentInput } from "./trainer-test-models";

type ProviderFetch = typeof globalThis.fetch;

// A request as OpenRouter received it: where it went, the key it carried and its body.
interface OpenRouterRequest {
  readonly authorization: string | null;
  readonly body: string;
  readonly model: string;
  readonly url: string;
}

const readRequest = async (
  input: Parameters<ProviderFetch>[0],
  init: Parameters<ProviderFetch>[1]
): Promise<OpenRouterRequest> => {
  const request = new Request(input, init);
  const body = await request.text();
  const { model } = JSON.parse(body) as { readonly model?: unknown };
  return {
    authorization: request.headers.get("authorization"),
    body,
    model: String(model),
    url: request.url,
  };
};

const question = { question: "Tell me about a project you're proud of." };

// A chat completion as OpenRouter answers it, from the model the request named.
const completion = ({ model }: OpenRouterRequest) =>
  Response.json({
    choices: [
      {
        finish_reason: "stop",
        index: 0,
        message: { content: JSON.stringify(question), role: "assistant" },
      },
    ],
    created: 1,
    id: "generation-test",
    model,
    object: "chat.completion",
  });

// OpenRouter's error envelope, with an HTTP status or, as OpenRouter also does, inside a 200.
const refused = (code: number, status = code) =>
  Response.json(
    { error: { code, message: "private-provider-message" } },
    { status }
  );

const fakeOpenRouter = (
  answer: (request: OpenRouterRequest) => Response = completion
) => {
  const requests: OpenRouterRequest[] = [];
  const providerFetch: ProviderFetch = async (input, init) => {
    const request = await readRequest(input, init);
    requests.push(request);
    return answer(request);
  };
  return { providerFetch, requests };
};

const openRouterKey: TrainerCredentials = {
  apiKey: Redacted.make("sk-or-test"),
  provider: "openrouter",
};

const withClient = <A, E>(
  providerFetch: ProviderFetch,
  use: (client: TrainerClient["Service"]) => Effect.Effect<A, E>
) =>
  Effect.runPromise(
    Effect.gen(function* () {
      return yield* use(yield* TrainerClient);
    }).pipe(
      Effect.provide(
        TrainerClient.layerWith(providerFetch).pipe(
          Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord({})))
        )
      )
    )
  );

const askQuestion = (providerFetch: ProviderFetch) =>
  withClient(providerFetch, (client) =>
    client.trainerFor(openRouterKey).continueInterview([])
  );

// The tag of the error a Trainer call fails with.
const failureOf = (providerFetch: ProviderFetch) =>
  withClient(providerFetch, (client) =>
    client
      .trainerFor(openRouterKey)
      .continueInterview([])
      .pipe(
        Effect.flip,
        Effect.map((error) => error._tag)
      )
  );

describe("Trainer on an OpenRouter key", () => {
  it("answers with google/gemini-3.5-flash through OpenRouter, on the visitor's key", async () => {
    const openRouter = fakeOpenRouter();

    const answer = await askQuestion(openRouter.providerFetch);

    expect(answer.model).toBe("google/gemini-3.5-flash");
    expect(
      openRouter.requests.map(({ authorization, model, url }) => ({
        authorization,
        model,
        url,
      }))
    ).toStrictEqual([
      {
        authorization: "Bearer sk-or-test",
        model: "google/gemini-3.5-flash",
        url: "https://openrouter.ai/api/v1/chat/completions",
      },
    ]);
  });

  it("falls back to google/gemini-3.5-flash-lite when the primary model is overloaded", async () => {
    const openRouter = fakeOpenRouter((request) =>
      request.model === "google/gemini-3.5-flash"
        ? refused(503)
        : completion(request)
    );

    const answer = await askQuestion(openRouter.providerFetch);

    expect(answer.model).toBe("google/gemini-3.5-flash-lite");
    expect(openRouter.requests.map(({ model }) => model)).toStrictEqual([
      "google/gemini-3.5-flash",
      "google/gemini-3.5-flash-lite",
    ]);
  });

  it("reads exhausted credits, a rate limit and a rejected key, in the status or the body", async () => {
    const answers = [
      () => refused(402),
      () => refused(429, 200),
      () => refused(401, 200),
      () => refused(502, 200),
    ];

    expect(
      await Promise.all(
        answers.map((answer) => failureOf(fakeOpenRouter(answer).providerFetch))
      )
    ).toStrictEqual([
      "TrainerQuotaExceededError",
      "TrainerQuotaExceededError",
      "TrainerKeyRejectedError",
      "TrainerUnavailableError",
    ]);
  });

  it("offers OpenRouter's Gemini models a schema without the keywords Gemini refuses", async () => {
    const openRouter = fakeOpenRouter(() => refused(400));

    await withClient(openRouter.providerFetch, (client) =>
      client
        .trainerFor(openRouterKey)
        .enrichFindings(enrichmentInput)
        .pipe(Effect.exit)
    );

    const [request] = openRouter.requests;
    expect(request?.body).toContain('"COUNTABLE_UNCOUNTABLE"');
    expect(request?.body).not.toMatch(/maxItems|minItems|\$schema/u);
  });
});

describe("Key test on an OpenRouter key", () => {
  it("tests the key on google/gemini-3.5-flash-lite and reads OpenRouter's answer", async () => {
    const answers: ((request: OpenRouterRequest) => Response)[] = [
      completion,
      () => refused(401),
      () => refused(402),
      () => refused(429, 200),
    ];

    const runs = await Promise.all(
      answers.map(async (answer) => {
        const openRouter = fakeOpenRouter(answer);
        const status = await withClient(openRouter.providerFetch, (client) =>
          client.testKey(openRouterKey)
        );
        return {
          models: openRouter.requests.map(({ model }) => model),
          status,
        };
      })
    );

    expect(runs).toStrictEqual([
      { models: ["google/gemini-3.5-flash-lite"], status: "works" },
      { models: ["google/gemini-3.5-flash-lite"], status: "invalid" },
      { models: ["google/gemini-3.5-flash-lite"], status: "busy" },
      { models: ["google/gemini-3.5-flash-lite"], status: "busy" },
    ]);
  });
});
