---
spec: good-m
ticket: none
tier: M
status: draft
---
# Brief: api

## Tests
| id | traces | task | level | gate | check |
|---|---|---|---|---|---|
| T-POL-1 | AC-2, D-1 | API-1 | unit | G-merge | A plain read writes no row. |

## Tasks

### API-0 · Record baselines
- Verify: `npm test` → baseline recorded

### API-1 · Skip rows for plain reads
- Implements: AC-2, D-1 · After: API-0 · Judgment: normal
- Tests first: T-POL-1
- Verify: `npm test` → green
