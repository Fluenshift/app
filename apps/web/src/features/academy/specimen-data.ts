import type { EvaluationFinding } from "@fluenshift/contract";

export interface SpecimenMistake {
  readonly byteEnd: number;
  readonly byteStart: number;
  readonly category: EvaluationFinding["category"];
  readonly correctedSpan: string;
  readonly note: string;
  readonly originalSpan: string;
}

export interface SpecimenScenario {
  readonly id: string;
  readonly label: string;
  readonly mistakes: readonly SpecimenMistake[];
  readonly text: string;
}

const stub = (label: string): SpecimenScenario => ({
  id: "stub",
  label,
  mistakes: [
    {
      byteEnd: 0,
      byteStart: 0,
      category: "Other",
      correctedSpan: "",
      note: "",
      originalSpan: "stub",
    },
  ],
  text: "",
});

export const SPECIMEN_SCENARIOS: readonly SpecimenScenario[] = [
  stub("Standup update"),
  stub("Code review comment"),
  stub("Email to a client"),
];

export const specimenFindings = (
  _scenario: SpecimenScenario
): EvaluationFinding[] => [];
