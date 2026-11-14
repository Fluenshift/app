// Characterization of apps/web/src/features/evaluations/http-evaluation-client.ts at the PE
// baseline: what a failure carries when its answer names no code or no retry flag, which
// http-evaluation-client.test.ts never sends.
import { describe, expect, test } from "vitest";

import {
  EvaluationRequestError,
  createHttpEvaluationClient,
} from "./http-evaluation-client";

describe("HTTP Evaluation client failures", () => {
  test("keeps a failure's code and retries one without a flag only from status 500", async () => {
    const answers = [
      new Response("Not Found", { status: 404 }),
      new Response("Bad Gateway", { status: 500 }),
      Response.json(
        { code: "not-ready", error: "History is not available" },
        { status: 503 }
      ),
    ];
    const failures = await Promise.all(
      answers.map((answer) =>
        createHttpEvaluationClient({ fetch: () => Promise.resolve(answer) })
          .listEvaluations()
          .catch((error: unknown) => error)
      )
    );

    expect(
      failures.map((failure) =>
        failure instanceof EvaluationRequestError
          ? {
              code: failure.code,
              retryable: failure.retryable,
              status: failure.status,
            }
          : failure
      )
    ).toEqual([
      { code: "request-failed", retryable: false, status: 404 },
      { code: "request-failed", retryable: true, status: 500 },
      { code: "not-ready", retryable: true, status: 503 },
    ]);
  });
});
