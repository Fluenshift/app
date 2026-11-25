// A looping example of what "proofed" means: three slips get underlined, then each shows its
// numbered correction. Ported from Grifando src/components/home/LiveSpecimen.tsx (74dbb9f); the
// marks come from PE's localization of the scenario's Findings (docs/adr/0004). The animated
// layer is hidden from assistive tech, which gets the plain-text version.
import { cn } from "@grifando/ui/utils";
import { useState } from "react";

import { buildTextSpans } from "../evaluations/spell-checker";
import { SPECIMEN_SCENARIOS, specimenFindings } from "./specimen-data";
import type { SpecimenScenario } from "./specimen-data";

interface Segment {
  readonly findingIndex: number | null;
  readonly start: number;
  readonly text: string;
}

// The paragraph cut at its marks, each mark numbered by its place in the scenario's list.
const segmentsOf = (scenario: SpecimenScenario): Segment[] => {
  const findings = specimenFindings(scenario);
  const marks = buildTextSpans(scenario.text, findings).toSorted(
    (a, b) => a.start - b.start
  );
  const segments: Segment[] = [];
  let cursor = 0;
  for (const mark of marks) {
    if (mark.start > cursor) {
      segments.push({
        findingIndex: null,
        start: cursor,
        text: scenario.text.slice(cursor, mark.start),
      });
    }
    segments.push({
      findingIndex:
        mark.finding === undefined ? null : findings.indexOf(mark.finding),
      start: mark.start,
      text: scenario.text.slice(mark.start, mark.end),
    });
    cursor = mark.end;
  }
  if (cursor < scenario.text.length) {
    segments.push({
      findingIndex: null,
      start: cursor,
      text: scenario.text.slice(cursor),
    });
  }
  return segments;
};

const [FIRST] = SPECIMEN_SCENARIOS;

export const LiveSpecimen = () => {
  const [activeId, setActiveId] = useState(FIRST?.id);
  const scenario =
    SPECIMEN_SCENARIOS.find((item) => item.id === activeId) ?? FIRST;
  if (scenario === undefined) {
    return null;
  }

  return (
    <div className="space-y-5">
      <fieldset
        aria-label="Example scenario"
        className="m-0 flex min-w-0 flex-wrap gap-2 border-0 p-0"
      >
        {SPECIMEN_SCENARIOS.map((item) => {
          const active = item.id === scenario.id;
          return (
            <button
              aria-pressed={active}
              className={cn(
                "rounded-pill h-9 px-4 text-sm transition-colors",
                active
                  ? "bg-foreground text-background"
                  : "bg-card text-iron ring-border hover:bg-linen ring-1"
              )}
              key={item.id}
              onClick={() => {
                setActiveId(item.id);
              }}
              type="button"
            >
              {item.label}
            </button>
          );
        })}
      </fieldset>

      <figure
        className="fade-in rounded-card bg-card ring-border p-6 ring-1 md:p-10"
        key={scenario.id}
      >
        <figcaption className="label-mono text-muted-foreground mb-6">
          Example · {scenario.label}
        </figcaption>

        <div
          aria-hidden="true"
          className="grid gap-x-16 gap-y-8 lg:grid-cols-[minmax(0,1fr)_380px]"
        >
          <p className="prose-serif text-xl leading-[1.7] md:text-2xl md:leading-[1.7]">
            {segmentsOf(scenario).map((segment) =>
              segment.findingIndex === null ? (
                <span key={segment.start}>{segment.text}</span>
              ) : (
                <span
                  className={`proof-mark specimen-loop specimen-loop-${String(segment.findingIndex + 1)}`}
                  key={segment.start}
                >
                  {segment.text}
                  <sup className="proof-mark-num text-violet ml-0.5 font-mono text-[0.625rem] font-medium">
                    {segment.findingIndex + 1}
                  </sup>
                </span>
              )
            )}
          </p>
          <ol className="space-y-4">
            {scenario.findings.map((finding, index) => (
              <li
                className={`specimen-note specimen-loop specimen-loop-${String(index + 1)} flex gap-3`}
                key={finding.originalSpan}
                style={{ animationDelay: "350ms" }}
              >
                <span className="text-violet pt-1.5 font-mono text-[0.625rem] font-medium">
                  {index + 1}
                </span>
                <div className="space-y-1">
                  <p className="prose-serif text-lg">
                    <span className="text-muted-foreground line-through decoration-1">
                      {finding.originalSpan}
                    </span>{" "}
                    <span>{finding.correctedSpan}</span>
                  </p>
                  <p className="text-muted-foreground text-sm">
                    {finding.note}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="sr-only">
          <p>Example of a proofed paragraph: {scenario.text}</p>
          <ol>
            {scenario.findings.map((finding) => (
              <li key={finding.originalSpan}>
                &quot;{finding.originalSpan}&quot; should be &quot;
                {finding.correctedSpan}&quot;. {finding.note}
              </li>
            ))}
          </ol>
        </div>
      </figure>
    </div>
  );
};
