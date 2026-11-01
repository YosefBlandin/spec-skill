---
spec: good-m
ticket: none
tier: M
status: draft
---
# Architecture

## Components
- api:src/libs/logger.ts#requestLogger skips plain reads (AC-2, D-1).

## Facts
| id | fact |
|---|---|
| F-1 | Every signed-in call writes one row today. |

## Risks
| id | risk | mitigation |
|---|---|---|
| RK-1 | A read that matters is skipped. | Listed in API-1 (F-1). |
