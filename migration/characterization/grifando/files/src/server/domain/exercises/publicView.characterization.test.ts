// Characterization of src/server/domain/exercises/publicView.ts at the Grifando baseline: the
// baseline test pins the whole public view of a fill-blank exercise only.
import { describe, expect, it } from "vitest";

import { toPublicExercise } from "@/server/domain/exercises/publicView";

describe("toPublicExercise guards", () => {
  it("keeps exactly the visible content of the other exercise types", () => {
    expect(
      toPublicExercise({
        type: "MULTIPLE_CHOICE",
        instruction: "Choose the correct sentence.",
        explanation: "secret",
        options: ["I depend of this library.", "I depend on this library."],
        correctOptionIndex: 1,
      }),
    ).toEqual({
      type: "MULTIPLE_CHOICE",
      instruction: "Choose the correct sentence.",
      options: ["I depend of this library.", "I depend on this library."],
    });
    expect(
      toPublicExercise({
        type: "REWRITE",
        instruction: "Rewrite naturally.",
        explanation: "secret",
        original: "I have difficulty to understand concurrency.",
        acceptableAnswers: ["I have difficulty understanding concurrency."],
      }),
    ).toEqual({
      type: "REWRITE",
      instruction: "Rewrite naturally.",
      original: "I have difficulty to understand concurrency.",
    });
    expect(
      toPublicExercise({
        type: "TRANSLATION",
        instruction: "Translate into English.",
        explanation: "secret",
        sourceText: "Eu dependo desta biblioteca.",
        acceptableAnswers: ["I depend on this library."],
      }),
    ).toEqual({
      type: "TRANSLATION",
      instruction: "Translate into English.",
      sourceText: "Eu dependo desta biblioteca.",
    });
  });
});
