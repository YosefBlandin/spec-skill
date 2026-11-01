---
spec: lint-noprofile
ticket: none
tier: M
status: draft
---
# Brief: app

## Tests
| id | traces | task | level | gate | check |
|---|---|---|---|---|---|
| T-APP-1 | AC-1 | APP-1 | unit | G-merge | The banner shows when offline. |

## Tasks

### APP-0 · Record baselines
- Verify: `flutter test` → baseline recorded

### APP-1 · Show the banner
- Implements: AC-1, D-1 · After: APP-0 · Judgment: normal
- Tests first: T-APP-1
