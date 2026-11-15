export interface InterviewHistoryItem {
  readonly answer: string;
  readonly question: string;
}

export const buildInterviewUserMessage = (
  _history: readonly InterviewHistoryItem[]
): string => "";
