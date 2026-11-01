---
spec: good-s
ticket: none
tier: S
status: draft
refs: api@0123abc
door: 2-way
appetite: 2 days
---
# Spec: health check timeout

## Outcome
The health check gives up after five seconds.

## Acceptance criteria
| id | statement | from |
|---|---|---|
| AC-1 | When the check takes more than five seconds, the system shall report it as failed. | user |

## Decisions
| id | decision | door | source, date | status |
|---|---|---|---|---|
| D-1 | Use a fixed timeout of five seconds. | 2-way | user, 2026-10-01 | accepted |

## Risks
| id | risk | mitigation |
|---|---|---|
| RK-1 | Slow networks report false failures. | T-API-1 covers the edge. |

## Tests
| id | traces | task | level | gate | check |
|---|---|---|---|---|---|
| T-API-1 | AC-1, D-1 | API-1 | unit | G-merge | A six second check fails. |

## Tasks

### API-0 · Record baselines
- Verify: `npm test` → baseline recorded

### API-1 · Add the timeout
- Implements: AC-1, D-1 · After: API-0 · Judgment: normal
- Tests first: T-API-1
- Verify: `npm test` → green

## Human needs
- <HUMAN: confirm the timeout with operations>
