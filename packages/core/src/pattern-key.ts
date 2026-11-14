// Ported from Grifando src/server/domain/mistakes/patternKey.ts; SPEC.md is Grifando's.

const MAX_PATTERN_KEY_LENGTH = 64;
const FALLBACK_PATTERN_KEY = "unspecified";

// Normalizes the AI-proposed pattern key so occurrences of the same mistake
// collapse into one MistakePattern row instead of near-duplicates (SPEC.md §6).
export const normalizePatternKey = (rawKey: string): string => {
  const slug = rawKey
    .toLowerCase()
    .trim()
    .replaceAll(/[^a-z0-9]+/gu, "-")
    .replaceAll(/^-+|-+$/gu, "")
    .slice(0, MAX_PATTERN_KEY_LENGTH)
    .replaceAll(/-+$/gu, "");

  return slug.length > 0 ? slug : FALLBACK_PATTERN_KEY;
};
