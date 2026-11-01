---
spec: good-l
ticket: none
tier: L
status: draft
---
# Architecture

## Components
- api:src/libs/logger.ts#requestLogger stops writing rows for plain reads (AC-2, D-1).
- web:src/hooks/usePageView.ts#usePageView sends one page-view call per page (AC-1).

## Contracts
- The page-view call takes a page key and returns 204.

```text
spec-lint ignores fenced code: D-88, X-1b, AC-1..9, <HUMAN: example>, TODO.
```

## Risks
| id | risk | mitigation |
|---|---|---|
| RK-1 | A read that matters is not on the list. | Review the list in API-1, using F-1. |
