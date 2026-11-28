// Hono's typed client sends each request body in the shape of the contract schema its route
// checks it with, so a body of another shape, a misspelled key among them, fails `tsc`
// (docs/adr/0007, docs/adr/0042). The assertions are types: Vitest runs nothing here.
import type {
  AttemptRequest,
  ExerciseGenerationRequest,
  InterviewAnswerRequest,
  PracticeWritingRequest,
  ProgressEvidenceRequest,
  WritingSampleRequest,
} from "@grifando/contract";
import type { hc, InferRequestType } from "hono/client";
import type { AppType } from "server/app";
import { describe, expectTypeOf, it } from "vitest";

type Api = ReturnType<typeof hc<AppType>>["api"];

describe("request bodies of the typed client", () => {
  it("are the encoded sides of the contract's request schemas", () => {
    expectTypeOf<
      InferRequestType<Api["evaluations"]["$post"]>["json"]
    >().toEqualTypeOf<typeof WritingSampleRequest.Encoded>();
    expectTypeOf<
      InferRequestType<Api["progress"]["evidence"]["$post"]>["json"]
    >().toEqualTypeOf<typeof ProgressEvidenceRequest.Encoded>();
    expectTypeOf<
      InferRequestType<Api["exercises"]["$post"]>["json"]
    >().toEqualTypeOf<typeof ExerciseGenerationRequest.Encoded>();
    expectTypeOf<
      InferRequestType<
        Api["exercises"][":exerciseId"]["attempts"]["$post"]
      >["json"]
    >().toEqualTypeOf<typeof AttemptRequest.Encoded>();
    expectTypeOf<
      InferRequestType<
        Api["interview"][":sessionId"]["turns"][":turnId"]["answer"]["$post"]
      >["json"]
    >().toEqualTypeOf<typeof InterviewAnswerRequest.Encoded>();
    expectTypeOf<
      InferRequestType<Api["practice-writing"]["$post"]>["json"]
    >().toEqualTypeOf<typeof PracticeWritingRequest.Encoded>();
  });

  it("refuse a body with a misspelled key", () => {
    expectTypeOf<{ writingSampel: string }>().not.toExtend<
      InferRequestType<Api["evaluations"]["$post"]>["json"]
    >();
  });
});
