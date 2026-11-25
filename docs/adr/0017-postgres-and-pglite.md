# 0017. Store data in Postgres, and in PGlite for local mode and tests

- Status: Accepted by Jhefferson on 2026-11-14 ([comment](https://github.com/Fluenshift/grifando/issues/5#issuecomment-6880924859)) on [#5](https://github.com/Fluenshift/grifando/issues/5). Levy's acceptance is pending; the migration proceeds meanwhile.
- Ledger rows: `decision: "adr:0017"`.

## Context

The approved stack replaces PE's SQLite with Postgres through Drizzle, with PGlite for tests and
local mode. Two PE rows depend on SQLite: "A successful Evaluation stays in local SQLite"
(DATA-POLICY) and the test that enables durable SQLite invariants
(`packages/db/src/index.test.ts`).

## Decision

The `hosted` profile uses Postgres 17. The `local` profile and the test suites use PGlite with
a data directory on a Docker volume. SQLite-specific invariants are replaced by their Postgres
equivalents: foreign keys, transactions and constraints in the schema.

## Consequences

- Rows `adr:0017` become `port-changed`: same durability guarantees, Postgres mechanisms.

## Alternatives

- Postgres in the local profile too: one more container for every local learner.
