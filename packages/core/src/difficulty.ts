// Ported from Grifando src/server/domain/exercises/difficulty.ts.
//
// Target difficulty: an Elo-style ability rating per mistake category, updated after every
// graded attempt, and exercises generated at the difficulty where the learner
// is expected to succeed about 70% of the time — hard enough to stretch,
// easy enough to stay motivating.
//
// Exercises carry a discrete level 1-5 (something the generator prompt can act
// on) mapped onto the Elo scale; only the learner's rating is updated, since
// each generated exercise is answered once.

export const DEFAULT_ABILITY = 1000;
export const TARGET_SUCCESS = 0.7;
export const MIN_LEVEL = 1;
export const MAX_LEVEL = 5;

// How far one result moves the rating. A surprising result (failing an easy
// exercise, passing a hard one) moves it a lot; an expected one barely does.
const K_FACTOR = 32;
const LEVEL_BASE_RATING = 700;
const RATING_PER_LEVEL = 100;

export const levelToRating = (level: number): number =>
  LEVEL_BASE_RATING + RATING_PER_LEVEL * level;

// Probability of a correct answer: the Elo / logistic IRT curve.
export const expectedSuccess = (
  ability: number,
  difficultyRating: number
): number => 1 / (1 + 10 ** ((difficultyRating - ability) / 400));

export const updateAbility = (
  ability: number,
  level: number,
  isCorrect: boolean
): number => {
  const expected = expectedSuccess(ability, levelToRating(level));
  return ability + K_FACTOR * ((isCorrect ? 1 : 0) - expected);
};

// The level whose expected success is closest to TARGET_SUCCESS, clamped to 1-5.
export const targetLevel = (ability: number): number => {
  const targetRating =
    ability - 400 * Math.log10(TARGET_SUCCESS / (1 - TARGET_SUCCESS));
  const level = Math.round(
    (targetRating - LEVEL_BASE_RATING) / RATING_PER_LEVEL
  );
  return Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, level));
};
