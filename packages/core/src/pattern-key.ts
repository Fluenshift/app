// Typed stub for the red commit of #16: the ported tests compile and fail on their checks.
// Every key keeps its raw text plus a trailing dash, so no expected key matches and different
// raw spellings stay different.
export const normalizePatternKey = (rawKey: string): string => `${rawKey}-`;
