---
spec: bad-markers
ticket: none
tier: M
status: locked-v1
refs: api@0123abc, web@4567def
door: 2-way
appetite: 2 days
---
# Intent

## Acceptance criteria
| id | statement | from |
|---|---|---|
| AC-1 | When a user opens a page, the system shall write one row. | user |

## Open
- Resolved marker: [NEEDS CLARIFICATION: Q-1]
- Unknown question: [NEEDS CLARIFICATION: Q-9]
- Bare marker: [NEEDS CLARIFICATION]
- Marker without an id: [NEEDS CLARIFICATION: which pages count]
- A human value in the wrong file: <HUMAN: the deploy key>
- TODO: name the owner.
- The date is TBD.
- FIXME before the next lock.

### Q-1 · Do tabs count as pages
Blocks: G-design · Default: A · Door: 2-way · Owner: product · Answer-by: 2026-10-12
Context: Some pages have tabs.
A. Pages only: fewer rows.
B. Pages and tabs: more rows.
If no answer by 2026-10-12, we build A.
