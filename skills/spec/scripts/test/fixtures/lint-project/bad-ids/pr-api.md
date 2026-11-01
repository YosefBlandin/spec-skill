---
spec: bad-ids
ticket: none
tier: M
status: draft
---
# Brief: api

## Tests
| id | traces | task | level | gate | check |
|---|---|---|---|---|---|
| T-POL-1 | AC-1 | API-1 | unit | G-merge | A plain read writes no row. |
| T-POL-2 | AC-3 | API-1 | unit | G-merge | A page view writes one row. |

## Tasks

### API-0 · Record baselines
- Verify: `npm test` → baseline recorded

### API-1 · Skip plain reads
- Implements: AC-1, D-1 · After: API-0 · Judgment: normal
- Then hand over to API-7 and WEB-1.
