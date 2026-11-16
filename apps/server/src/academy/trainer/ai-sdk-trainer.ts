// The Trainer's calls on the AI SDK: one implementation for every provider (docs/adr/0012).
// Ported from Grifando src/server/ai/providers/anthropic.ts and gemini.ts (74dbb9f), with the
// status mapping of src/server/ai/errors.ts. An answer that its schema or the exercise rules
// refuse is an AIResponseValidationError; an API failure maps by status; a network failure or an
// abort is unavailable. Every result names the model that answered (Grifando #77).
import {
  AIResponseValidationError,
  errorCategoryOf,
  exerciseGenerationResultSchema,
  MISTAKE_CATEGORIES,
  validateExerciseGenerationResult,
} from "@fluenshift/contract";
import {
  APICallError,
  generateText,
  jsonSchema,
  NoObjectGeneratedError,
  Output,
} from "ai";
import type { LanguageModel } from "ai";
import { Effect, Option, pipe, Schema } from "effect";

import {
  buildAnswerExplanationSystemPrompt,
  buildAnswerExplanationUserMessage,
} from "../prompts/answer-explanation";
import {
  buildEnrichmentSystemPrompt,
  buildEnrichmentUserMessage,
} from "../prompts/enrichment";
import type { EnrichmentFinding } from "../prompts/enrichment";
import {
  buildExerciseGenerationSystemPrompt,
  buildExerciseGenerationUserMessage,
} from "../prompts/exercise-generation";
import {
  buildInterviewSystemPrompt,
  buildInterviewUserMessage,
} from "../prompts/interview";
import {
  TrainerKeyRejectedError,
  TrainerQuotaExceededError,
  TrainerUnavailableError,
} from "./trainer-errors";
import type { TrainerError } from "./trainer-errors";
import type { FindingEnrichment, TrainerMethods } from "./trainer-model";

// Grifando's limit for the writing analysis, which the Enrichment replaces.
const ENRICHMENT_MAX_TOKENS = 4096;
const EXERCISE_GENERATION_MAX_TOKENS = 4096;
const INTERVIEW_QUESTION_MAX_TOKENS = 1024;
const ANSWER_EXPLANATION_MAX_TOKENS = 1024;

export const interviewQuestionResultSchema = Schema.Struct({
  question: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(500)),
});

export const answerExplanationResultSchema = Schema.Struct({
  explanation: Schema.String.check(
    Schema.isMinLength(1),
    Schema.isMaxLength(1500)
  ),
});

// The Mistake Categories a Finding may take: those that roll up to an Error Category
// (docs/adr/0005).
const FINDING_MISTAKE_CATEGORIES = MISTAKE_CATEGORIES.filter(
  (category) => errorCategoryOf(category) !== undefined
);

// The Academy fields of Grifando's mistake schema (src/server/ai/schemas/writingAnalysis.ts,
// 74dbb9f), with their bounds, for the numbered Finding each entry enriches.
export const enrichmentResultSchema = Schema.Struct({
  findings: Schema.Array(
    Schema.Struct({
      category: Schema.Literals(FINDING_MISTAKE_CATEGORIES),
      example: Schema.String.check(
        Schema.isMinLength(1),
        Schema.isMaxLength(500)
      ),
      finding: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
      // Optional, as in Grifando: an answer without it reads as no transfer.
      l1Transfer: Schema.optionalKey(Schema.Boolean),
      patternKey: Schema.String.check(
        Schema.isMinLength(1),
        Schema.isMaxLength(80)
      ),
    })
  ),
});

type EnrichmentEntry = (typeof enrichmentResultSchema.Type)["findings"][number];

const refused = (message: string) =>
  new AIResponseValidationError({ issues: [], message });

// The enrichment of the Finding numbered `number`: an entry names it, and its Mistake Category
// rolls up to the Finding's Error Category (docs/adr/0005). With as many entries as Findings, an
// entry for every Finding leaves none named twice.
const enrichmentOf = (
  entries: readonly EnrichmentEntry[],
  finding: EnrichmentFinding,
  number: number
): Effect.Effect<FindingEnrichment, AIResponseValidationError> => {
  const entry = entries.find((candidate) => candidate.finding === number);
  if (entry === undefined) {
    return Effect.fail(refused(`Finding ${number} has no enrichment`));
  }
  if (errorCategoryOf(entry.category) !== finding.category) {
    return Effect.fail(
      refused(
        `${entry.category} is not a Mistake Category of ${finding.category}`
      )
    );
  }
  return Effect.succeed({
    category: entry.category,
    example: entry.example,
    l1Transfer: entry.l1Transfer ?? false,
    patternKey: entry.patternKey,
  });
};

const UNAVAILABLE_STATUSES = new Set([500, 502, 503, 504, 529]);
const INVALID_KEY_MESSAGE = /api key not valid|api_key_invalid/iu;

// Shared by every provider, so they classify HTTP statuses identically.
export const accessErrorForStatus = (
  status: number,
  message = ""
): TrainerError | undefined => {
  if (status === 401 || status === 403) {
    return new TrainerKeyRejectedError();
  }
  if (status === 400 && INVALID_KEY_MESSAGE.test(message)) {
    return new TrainerKeyRejectedError();
  }
  if (status === 429) {
    return new TrainerQuotaExceededError();
  }
  if (UNAVAILABLE_STATUSES.has(status)) {
    return new TrainerUnavailableError();
  }
  return undefined;
};

const NETWORK_FAILURES = new Set([
  "AbortError",
  "APIConnectionError",
  "APIConnectionTimeoutError",
]);

// A failure no rule below names; it becomes a defect.
class UnmappedTrainerFailure extends Schema.TaggedError<
  UnmappedTrainerFailure,
  { readonly brand: unique symbol }
>()("UnmappedTrainerFailure", { cause: Schema.Unknown }) {}

// A failed AI SDK call as the Trainer reports it.
const trainerFailure = (
  cause: unknown
): TrainerError | UnmappedTrainerFailure => {
  if (NoObjectGeneratedError.isInstance(cause)) {
    return new AIResponseValidationError({
      issues: [],
      message: "The model returned no valid answer",
    });
  }
  if (APICallError.isInstance(cause)) {
    if (cause.statusCode === undefined) {
      return new TrainerUnavailableError();
    }
    return (
      accessErrorForStatus(cause.statusCode, cause.message) ??
      new UnmappedTrainerFailure({ cause })
    );
  }
  if (
    cause instanceof TypeError ||
    (cause instanceof Error && NETWORK_FAILURES.has(cause.name))
  ) {
    return new TrainerUnavailableError();
  }
  return new UnmappedTrainerFailure({ cause });
};

const GEMINI_UNSUPPORTED_KEYS = new Set(["$schema", "maxItems", "minItems"]);

const jsonSchemaOf = (schema: Schema.Top): Record<string, unknown> => {
  const { definitions, schema: root } = Schema.toJsonSchemaDocument(schema);
  return Object.keys(definitions).length === 0
    ? { ...root }
    : { ...root, $defs: definitions };
};

// Gemini rejects array bounds and `$schema` in a response schema; the rest stays.
export const toGeminiSchema = (schema: Schema.Top): unknown =>
  JSON.parse(
    JSON.stringify(jsonSchemaOf(schema), (key, value: unknown) =>
      GEMINI_UNSUPPORTED_KEYS.has(key) ? undefined : value
    )
  );

const isGemini = (model: LanguageModel) =>
  typeof model !== "string" && model.provider.startsWith("google");

// The structured answer a call asks for: the schema as JSON Schema for the provider, and the
// schema itself to decode what comes back.
const answerOf = <A>(
  name: string,
  schema: Schema.Codec<A, unknown>,
  model: LanguageModel
) => {
  const decode = Schema.decodeUnknownOption(schema);
  return Output.object({
    name,
    schema: jsonSchema<A>(
      isGemini(model)
        ? (toGeminiSchema(schema) as object)
        : jsonSchemaOf(schema),
      {
        validate: (value) =>
          Option.match(decode(value), {
            onNone: () => ({
              error: new Error(`The answer does not match ${name}`),
              success: false as const,
            }),
            onSome: (decoded) => ({ success: true as const, value: decoded }),
          }),
      }
    ),
  });
};

// One AI SDK call as the Trainer reports it; a failure no rule names stays a defect.
const calling = <A>(call: (signal: AbortSignal) => PromiseLike<A>) =>
  Effect.tryPromise({ catch: trainerFailure, try: call }).pipe(
    Effect.catchTag("UnmappedTrainerFailure", (failure) =>
      Effect.die(failure.cause)
    )
  );

// Key check: the smallest real request, one output token. Not a Trainer call: it succeeds when
// the key works, and fails as a Trainer call does otherwise.
export const testKey = Effect.fn("Trainer.testKey")(function* (
  model: LanguageModel
) {
  yield* calling((signal) =>
    generateText({
      abortSignal: signal,
      maxOutputTokens: 1,
      maxRetries: 0,
      model,
      prompt: "Hi",
    })
  );
});

export const createAiSdkTrainer = (model: LanguageModel): TrainerMethods => {
  const ask = <A>(request: {
    readonly maxOutputTokens: number;
    readonly name: string;
    readonly prompt: string;
    readonly schema: Schema.Codec<A, unknown>;
    readonly system: string;
  }) =>
    calling((signal) =>
      generateText({
        abortSignal: signal,
        maxOutputTokens: request.maxOutputTokens,
        maxRetries: 0,
        model,
        output: answerOf(request.name, request.schema, model),
        prompt: request.prompt,
        system: request.system,
      })
    ).pipe(
      Effect.map((response) => ({
        answer: response.output,
        model: response.response.modelId,
      }))
    );

  return {
    continueInterview: Effect.fn("Trainer.continueInterview")(
      function* (history) {
        const { answer, model: answeredBy } = yield* ask({
          maxOutputTokens: INTERVIEW_QUESTION_MAX_TOKENS,
          name: "submit_interview_question",
          prompt: buildInterviewUserMessage(history),
          schema: interviewQuestionResultSchema,
          system: buildInterviewSystemPrompt(),
        });
        return { model: answeredBy, question: answer.question };
      }
    ),
    enrichFindings: Effect.fn("Trainer.enrichFindings")(function* (input) {
      const { answer, model: answeredBy } = yield* ask({
        maxOutputTokens: ENRICHMENT_MAX_TOKENS,
        name: "submit_enrichment",
        prompt: buildEnrichmentUserMessage(input),
        schema: enrichmentResultSchema,
        system: buildEnrichmentSystemPrompt(),
      });
      if (answer.findings.length !== input.findings.length) {
        return yield* refused(
          `Expected ${input.findings.length} enrichments, got ${answer.findings.length}`
        );
      }
      const findings = yield* pipe(
        input.findings,
        Effect.forEach((finding, index) =>
          enrichmentOf(answer.findings, finding, index + 1)
        )
      );
      return { findings, model: answeredBy };
    }),
    explainAttempt: Effect.fn("Trainer.explainAttempt")(function* (input) {
      const { answer, model: answeredBy } = yield* ask({
        maxOutputTokens: ANSWER_EXPLANATION_MAX_TOKENS,
        name: "submit_answer_explanation",
        prompt: buildAnswerExplanationUserMessage(input),
        schema: answerExplanationResultSchema,
        system: buildAnswerExplanationSystemPrompt(),
      });
      return { explanation: answer.explanation, model: answeredBy };
    }),
    generateExercises: Effect.fn("Trainer.generateExercises")(
      function* (targets) {
        const { answer, model: answeredBy } = yield* ask({
          maxOutputTokens: EXERCISE_GENERATION_MAX_TOKENS,
          name: "submit_exercises",
          prompt: buildExerciseGenerationUserMessage(targets),
          schema: exerciseGenerationResultSchema,
          system: buildExerciseGenerationSystemPrompt(),
        });
        const exercises = yield* Effect.try({
          catch: (error) =>
            error instanceof AIResponseValidationError
              ? error
              : new AIResponseValidationError({
                  issues: [],
                  message: String(error),
                }),
          try: () => validateExerciseGenerationResult(answer, targets.length),
        });
        return { exercises, model: answeredBy };
      }
    ),
  };
};
