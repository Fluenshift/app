import type { LiveCalibrationFixture } from "./live-calibration-fixtures";
// Typed stub for the red commit: every check passes and the budget is never exceeded.
import type { ModelAssessment } from "./model-assessment";

export const validateFixtureAssessment = (
  _fixture: LiveCalibrationFixture,
  _assessment: ModelAssessment
): string[] => [];

export const validateFixtureSet = (
  _fixtures: readonly LiveCalibrationFixture[]
): string[] => [];

export const validateCalibrationBudget = (
  _previousSpend: number
): string[] => [];
