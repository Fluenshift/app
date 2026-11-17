# 0022. Document clauses live on in the merged documents

- Status: Accepted on 2026-11-17 by the session (ADR 0020).
- Ledger rows: `decision: "adr:0022"`.

## Context

The inventory gave every clause of PE's `REQUIREMENTS.md`, `RUBRIC.md` and `DATA-POLICY.md`,
and every section of Grifando's `SPEC.md` and bullet of its `CLAUDE.md`, a ledger row, so that
behavior written only in a document would not be lost. On 2026-11-17, 146 of those rows were
still open.

Phase 1 carried each of these clauses into the merged documents: PE's FR and QR IDs unchanged
in `docs/product/REQUIREMENTS.md`, its rubric and data policy in `RUBRIC.md` and
`DATA-POLICY.md`, and Grifando's sections and architecture rules in the AR requirements,
`CONTEXT.md` and the ADRs. Wherever the behavior is built, the ported tests and the
characterizations pin it. A clause row asks for one more test per paragraph of prose, which adds
no check the suites do not make, and keeps the parity check from ever reaching 100%.

## Decision

1. Every `requirement`, `doc-rule`, `spec-section` and `doc-bullet` row that is still `port` or
   `port-changed` becomes `superseded` with `decision: "adr:0022"`: the merged documents carry
   it.
2. Rows that describe behavior through code stay as they are: fix commits and issues keep their
   disposition until a test pins them.
3. The merged documents must still match the code (`MIGRATION_PROTOCOL.md`, definition of done,
   item 6). A clause the code does not meet is a defect that a unit fixes, in the code or in the
   document, as #118 did.

## Consequences

- 146 rows become terminal: 113 in `evaluation-policy`, 33 in `academy-spec`.
- The `port-changed` rows among them lose the ADR named in their `decision`; their change lives
  in the merged documents, which cite that ADR.

## Alternatives

- One test per clause: 146 tests that restate prose the ported suites already pin where it is
  built.
- `informative`: these clauses are normative, and the merged documents keep them so.
