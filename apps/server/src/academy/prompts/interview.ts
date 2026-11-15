// Ported from Grifando src/server/ai/prompts/interview.ts (74dbb9f).
export interface InterviewHistoryItem {
  readonly answer: string;
  readonly question: string;
}

export const buildInterviewSystemPrompt = (): string =>
  `You are conducting a realistic software engineering interview with a Brazilian Portuguese-speaking developer who is practicing English communication for technical interviews.

Ask exactly one question per turn. Mix technical questions (architecture, debugging, past projects, system design) with behavioral questions (teamwork, conflict, learning from mistakes). Keep questions natural and conversational, the way a real interviewer speaks — not a written exam.

When there is prior conversation, ask a natural follow-up that responds to what the candidate just said before moving to a new topic, the way a real interviewer engages with an answer rather than reading off a fixed list.

Call the provided tool with only the next question — nothing else.`;

export const buildInterviewUserMessage = (
  history: readonly InterviewHistoryItem[]
): string => {
  if (history.length === 0) {
    return "Start the interview with an opening question.";
  }

  const lines = history.map(
    (turn, index) =>
      `Q${index + 1}: ${turn.question}\nA${index + 1}: ${turn.answer}`
  );

  return `Conversation so far:\n\n${lines.join("\n\n")}\n\nAsk the next question.`;
};
