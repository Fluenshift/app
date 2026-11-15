import { describe, expect, it } from "vitest";

import { buildInterviewUserMessage } from "./interview";

describe("buildInterviewUserMessage", () => {
  it("asks for an opening question when there is no history", () => {
    const message = buildInterviewUserMessage([]);
    expect(message.toLowerCase()).toContain("opening question");
  });

  it("includes every prior question and answer in order", () => {
    const message = buildInterviewUserMessage([
      {
        question: "Tell me about yourself.",
        answer: "I am a backend developer.",
      },
      { question: "What was your last project?", answer: "A payments API." },
    ]);

    expect(message).toContain("Tell me about yourself.");
    expect(message).toContain("I am a backend developer.");
    expect(message.indexOf("Tell me about yourself.")).toBeLessThan(
      message.indexOf("What was your last project?")
    );
  });
});
