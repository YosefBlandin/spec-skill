---
spec: good-l
ticket: none
tier: L
status: draft
---
# Release

| gate | owner | check |
|---|---|---|
| G-merge | HUMAN | CI is green on both PRs. |
| G-promote | HUMAN | <HUMAN: run T-PV-1 on staging> |

## Rollback
Revert the API PR first, then the web PR (D-2).
