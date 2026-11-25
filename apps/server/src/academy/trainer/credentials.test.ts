// Ported from Grifando src/server/ai/credentials.test.ts (74dbb9f). A key is held as a Redacted
// value here, so the cases compare what it reveals; Effect.runSync throws the tagged error the
// way Grifando's functions threw. resolveAICredentials is re-expressed under docs/adr/0012: the
// local profile's configured key replaces the development environment keys, and the hosted
// profile never uses one.
import { ServerConfig, TrainerConfig } from "@grifando/env";
import { ConfigProvider, Effect, Layer, Redacted } from "effect";
import { describe, expect, it } from "vitest";

import { NotFoundError } from "../errors";
import { accessErrorForStatus } from "./ai-sdk-trainer";
import {
  readTrainerCredentials,
  resolveTrainerCredentials,
  trainerErrorResponse,
} from "./credentials";
import type { TrainerCredentials } from "./trainer-client";
import {
  InvalidTrainerCredentialsError,
  TrainerKeyRejectedError,
  TrainerQuotaExceededError,
  TrainerUnavailableError,
} from "./trainer-errors";

const h = (init: Record<string, string>) => new Headers(init);

const revealed = (credentials: TrainerCredentials | null) =>
  credentials === null
    ? null
    : {
        apiKey: Redacted.value(credentials.apiKey),
        provider: credentials.provider,
      };

const read = (headers: Headers) =>
  revealed(Effect.runSync(readTrainerCredentials(headers)));

const LOCAL = { DATA_DIRECTORY: "/tmp/fluenshift-unused" };
const HOSTED = {
  DATABASE_URL: "postgres://unused@127.0.0.1:1/unused",
  DEPLOY_PROFILE: "hosted",
};

const resolveWith = (env: Record<string, string>, headers: Headers) =>
  Effect.runPromise(
    resolveTrainerCredentials(headers).pipe(
      Effect.provide(
        Layer.mergeAll(ServerConfig.layer, TrainerConfig.layer).pipe(
          Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnvRecord(env)))
        )
      )
    )
  ).then(revealed);

// Grifando wrote `aiErrorResponse(...)!`; lint forbids the non-null assertion.
const responded = (response: Response | null) => {
  if (response === null) {
    throw new Error("Expected a response");
  }
  return response;
};

// The browser's one key may be for OpenRouter (docs/adr/0035).
describe("readTrainerCredentials on an OpenRouter key", () => {
  it("reads an OpenRouter key from the request headers", () => {
    expect(
      read(h({ "x-ai-provider": "openrouter", "x-ai-key": "sk-or-test" }))
    ).toEqual({ apiKey: "sk-or-test", provider: "openrouter" });
  });
});

describe("readAICredentials", () => {
  it("trims the key", () => {
    expect(
      read(h({ "x-ai-provider": "gemini", "x-ai-key": "  k1 \n" }))
    ).toEqual({
      apiKey: "k1",
      provider: "gemini",
    });
  });

  it("returns null without headers", () => {
    expect(read(h({}))).toBeNull();
  });

  it("rejects unknown provider, oversized and non-printable keys", () => {
    expect(() =>
      read(h({ "x-ai-provider": "openai", "x-ai-key": "k" }))
    ).toThrow(InvalidTrainerCredentialsError);
    expect(() =>
      read(h({ "x-ai-provider": "gemini", "x-ai-key": "k".repeat(257) }))
    ).toThrow(InvalidTrainerCredentialsError);
    expect(() =>
      read(h({ "x-ai-provider": "gemini", "x-ai-key": "k\u0001" }))
    ).toThrow(InvalidTrainerCredentialsError);
  });
});

describe("resolveAICredentials", () => {
  it("never uses configured keys in the hosted profile", async () => {
    expect(
      await resolveWith(
        { ...HOSTED, AI_PROVIDER: "gemini", GEMINI_API_KEY: "env" },
        h({})
      )
    ).toBeNull();
  });

  it("falls back to configured keys in the local profile", async () => {
    expect(
      await resolveWith(
        { ...LOCAL, AI_PROVIDER: "gemini", GEMINI_API_KEY: "env" },
        h({})
      )
    ).toEqual({ apiKey: "env", provider: "gemini" });
  });

  it("prefers header credentials over configured keys", async () => {
    expect(
      await resolveWith(
        { ...LOCAL, ANTHROPIC_API_KEY: "env" },
        h({ "x-ai-provider": "gemini", "x-ai-key": "hdr" })
      )
    ).toEqual({ apiKey: "hdr", provider: "gemini" });
  });
});

describe("aiErrorResponse", () => {
  it("maps a rejected key to 401 AI_KEY_REJECTED without echoing the key", async () => {
    const res = responded(trainerErrorResponse(new TrainerKeyRejectedError()));
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ code: "AI_KEY_REJECTED" });
  });

  it("returns null for unrelated errors", () => {
    expect(trainerErrorResponse(new Error("x"))).toBeNull();
  });

  it("returns null for a tagged error the Learner cannot act on", () => {
    expect(
      trainerErrorResponse(new NotFoundError({ resource: "Exercise" }))
    ).toBeNull();
  });
});

describe("accessErrorForStatus", () => {
  it("classifies provider statuses", () => {
    expect(accessErrorForStatus(401)).toBeInstanceOf(TrainerKeyRejectedError);
    expect(accessErrorForStatus(403)).toBeInstanceOf(TrainerKeyRejectedError);
    expect(
      accessErrorForStatus(
        400,
        "API key not valid. Please pass a valid API key."
      )
    ).toBeInstanceOf(TrainerKeyRejectedError);
    expect(accessErrorForStatus(400, "bad schema")).toBeNull();
    expect(accessErrorForStatus(429)).toBeInstanceOf(TrainerQuotaExceededError);
    expect(accessErrorForStatus(503)).toBeInstanceOf(TrainerUnavailableError);
    expect(accessErrorForStatus(404)).toBeNull();
  });
});
