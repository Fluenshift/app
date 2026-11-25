// Fixed, hand-written examples of proofed paragraphs, each with three of the slips a Portuguese
// speaker most often makes at work. Not the Learner's data. Ported from Grifando
// src/components/home/specimenData.ts (74dbb9f) under docs/adr/0004: each mark is a Finding at
// validated byte offsets, listed in the order it appears in the text, with the Error Category
// its slip rolls up to (docs/adr/0005).
import type { EvaluationFinding } from "@grifando/contract";

export interface SpecimenFinding {
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
  readonly findings: readonly SpecimenFinding[];
  readonly text: string;
}

export const SPECIMEN_SCENARIOS: readonly SpecimenScenario[] = [
  {
    id: "standup",
    label: "Standup update",
    findings: [
      {
        byteEnd: 68,
        byteStart: 56,
        category: "Verb form/tense",
        correctedSpan: "will work",
        note: 'After "will" the verb comes bare, with no "to".',
        originalSpan: "will to work",
      },
      {
        byteEnd: 106,
        byteStart: 88,
        category: "Preposition",
        correctedSpan: "waiting for the review",
        note: '"Wait" takes "for", unlike "esperar" in Portuguese.',
        originalSpan: "waiting the review",
      },
      {
        byteEnd: 158,
        byteStart: 126,
        category: "Verb form/tense",
        correctedSpan: "have not received any feedback yet",
        note: 'With "yet", English uses the present perfect.',
        originalSpan: "did not receive any feedback yet",
      },
    ],
    text: "Yesterday I fixed the bug on the login page and today I will to work on the tests. I am waiting the review since Monday, so I did not receive any feedback yet.",
  },
  {
    id: "review",
    label: "Code review comment",
    findings: [
      {
        byteEnd: 46,
        byteStart: 31,
        category: "Grammar/syntax",
        correctedSpan: "too many things",
        note: '"Things" is countable, so it takes "many".',
        originalSpan: "too much things",
      },
      {
        byteEnd: 70,
        byteStart: 56,
        category: "Preposition",
        correctedSpan: "explain to me why",
        note: '"Explain" needs "to" before the person.',
        originalSpan: "explain me why",
      },
      {
        byteEnd: 164,
        byteStart: 136,
        category: "Preposition",
        correctedSpan: "not sure about the performance",
        note: 'The preposition after "sure" is "about".',
        originalSpan: "not sure for the performance",
      },
    ],
    text: "I think this function is doing too much things. Can you explain me why you used a loop here? Maybe we can make it more simple, but I am not sure for the performance.",
  },
  {
    id: "email",
    label: "Email to a client",
    findings: [
      {
        byteEnd: 43,
        byteStart: 32,
        category: "Grammar/syntax",
        correctedSpan: "inform you that",
        note: '"Inform" needs its object: who is being informed.',
        originalSpan: "inform that",
      },
      {
        byteEnd: 115,
        byteStart: 106,
        category: "Word choice",
        correctedSpan: "any questions",
        note: 'Here "dúvida" is "question", not "doubt".',
        originalSpan: "any doubt",
      },
      {
        byteEnd: 157,
        byteStart: 141,
        category: "Preposition",
        correctedSpan: "next week",
        note: 'Time words like "next week" take no preposition.',
        originalSpan: "in the next week",
      },
    ],
    text: "Dear Mr. Smith, I am writing to inform that the invoice was already sent. Please, let me know if you have any doubt, and I will be available in the next week.",
  },
];

/** A scenario's marks as Findings, for PE's localization to place. */
export const specimenFindings = (
  scenario: SpecimenScenario
): EvaluationFinding[] =>
  scenario.findings.map((finding) => ({
    byteEnd: finding.byteEnd,
    byteStart: finding.byteStart,
    category: finding.category,
    correction: finding.correctedSpan,
    explanation: finding.note,
    originalText: finding.originalSpan,
    severity: "Minor",
  }));
