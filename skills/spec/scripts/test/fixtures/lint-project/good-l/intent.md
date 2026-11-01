---
spec: good-l
ticket: none
tier: L
status: draft
refs: api@0123abc, web@4567def
door: 1-way
appetite: 2 days
---
# Intent: page-view logs

## Outcome
Admins see one row for each page a colleague opens, not one row for each call behind it.

## Why
Today one page load writes many rows, and they do not show what the user did.

## Acceptance criteria
| id | statement | from |
|---|---|---|
| AC-1 | When a user opens a page, the system shall write one page-view row. | ticket AC 1 |
| AC-2 | While a read is plain, the system shall not write a row for it. | D-1 |
| AC-3 | RETIRED → AC-2 | user |

## No-gos
- No change to how long rows are kept.

## Open
- Tabs are still open: [NEEDS CLARIFICATION: Q-1]

<!--
Template guidance. spec-lint ignores everything in this comment:
AC-1..3, D-1b, D-77, T-POL-1/2, G-4, <HUMAN: example>, [NEEDS CLARIFICATION], TODO.
-->

## Glossary
- Page view: one open of a page or a tab.
