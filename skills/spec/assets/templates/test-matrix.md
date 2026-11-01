---
spec: {{spec}}
ticket: {{ticket}}
tier: {{tier}}
status: {{status}}
---
# {{title}}: test matrix

<!-- One row per test, written at handoff: id (T-AREA-n), traces (AC or decision ids), task (a task id from a pr file, or manual), level (unit, int, e2e or manual), gate (G-merge, G-promote or none), check (one line). -->
<!-- Put the id in the real test title so grep finds it. Executors read only their own PR's rows. spec-lint checks that every AC is traced by a row or named in "Accepted, no test", and that every row names a task or manual, so there is no separate traceability table. Examples sit in these comments. -->

## Automated
<!-- unit and int rows, grouped by PR. Keep the check terse: one line, no Given/When/Then. When the change classifies a set (routes, keys, types), add one coverage test that pins the count, so a new member fails CI until someone classifies it. -->
| Test | Traces | Task | Level | Gate | Check |
|---|---|---|---|---|---|

## End-to-end and manual
<!-- e2e rows and checks a person runs, in Given/When/Then. Fixtures use internal ids only; credentials never go in this folder. release.md says who runs each manual row and when. Example row: | T-E2E-1 | AC-1, D-1 | manual | manual | G-promote | Given a signed-in user, when they open a page that makes several calls, then exactly one page-view event appears. | -->
| Test | Traces | Task | Level | Gate | Check |
|---|---|---|---|---|---|

## Accepted, no test
<!-- Edge cases, or ACs, closed by a decision or a risk instead of a test, with a one-line reason. Name the AC id when the row covers one. Example row: | Events written before the release have no page type. | RK-1 | They expire on their own; no backfill. | -->
| Edge case | Closed by | Reason |
|---|---|---|
