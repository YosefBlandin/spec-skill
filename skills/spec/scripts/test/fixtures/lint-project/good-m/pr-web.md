---
spec: good-m
ticket: none
tier: M
status: draft
---
# Brief: web

## Tests
| id | traces | task | level | gate | check |
|---|---|---|---|---|---|
| T-WEB-1 | AC-1 | WEB-1 | unit | G-merge | Opening a page sends one call. |

## Tasks

### WEB-0 · Record baselines
- Verify: `npm test` → baseline recorded

### WEB-1 · Send page views
- Implements: AC-1, D-2 · After: WEB-0 · Judgment: normal
- Tests first: T-WEB-1
- Verify: `npm test` → green
