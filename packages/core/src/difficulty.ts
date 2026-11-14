// Typed stub for the red commit of #15: the ported tests compile and fail on their checks.
// NaN fails every numeric check: no equality, closeness or ordering holds for it.

export const DEFAULT_ABILITY = Number.NaN;
export const MIN_LEVEL = 1;
export const MAX_LEVEL = 5;

export const levelToRating = (_level: number): number => Number.NaN;

export const expectedSuccess = (
  _ability: number,
  _difficultyRating: number
): number => Number.NaN;

export const updateAbility = (
  _ability: number,
  _level: number,
  _isCorrect: boolean
): number => Number.NaN;

export const targetLevel = (_ability: number): number => Number.NaN;
