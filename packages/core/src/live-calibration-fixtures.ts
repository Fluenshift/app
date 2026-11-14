import type {
  ErrorCategory,
  FindingSeverity,
  ProficiencyBand,
} from "./rubric-v1";

export const LIVE_CALIBRATION_REQUIREMENTS = [
  "FR-08",
  "FR-09",
  "FR-11",
  "FR-27",
  "FR-28",
  "FR-29",
  "QR-01",
  "QR-05",
  "QR-06",
  "QR-09",
  "QR-10",
] as const;

export type LiveCalibrationRequirement =
  (typeof LIVE_CALIBRATION_REQUIREMENTS)[number];

export interface ExpectedLiveFinding {
  readonly category: ErrorCategory;
  readonly corrections?: readonly string[];
  readonly originalText?: readonly string[];
  readonly severity: FindingSeverity;
}

export interface ExpectedLiveSuggestion {
  readonly alternatives?: readonly string[];
  readonly originalText: readonly string[];
  readonly requireMissingContext: true;
  readonly requireNonErrorLabel: true;
}

export interface LiveCalibrationFixture {
  readonly consistencyRepetitions?: 2;
  readonly expected:
    | {
        readonly band: ProficiencyBand;
        readonly correctedText: string | "changed";
        readonly findings: readonly ExpectedLiveFinding[];
        readonly nonEnglishSpans: readonly string[];
        readonly outcome: "evaluation";
        readonly score: number;
        readonly suggestions:
          | readonly ExpectedLiveSuggestion[]
          | "optional-context";
      }
    | {
        readonly findings: readonly [];
        readonly nonEnglishSpans: readonly string[];
        readonly outcome: "no-english";
        readonly suggestions: readonly [];
      };
  readonly id: string;
  readonly rationale: string;
  readonly requirements: readonly LiveCalibrationRequirement[];
  readonly writingSample: string;
}

// Typed stub for the red commit: no fixture is frozen yet.
export const LIVE_CALIBRATION_FIXTURES: readonly LiveCalibrationFixture[] = [];
