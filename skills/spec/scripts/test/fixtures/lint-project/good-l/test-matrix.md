---
spec: good-l
ticket: none
tier: L
status: draft
---
# Test matrix

| id | traces | task | level | gate | check |
|---|---|---|---|---|---|
| T-POL-1 | AC-2, D-1 | API-1 | unit | G-merge | A plain read writes no row. |
| T-PV-1 | AC-1 | WEB-1 | e2e | G-promote | Given a user, when they open a page, then one row appears. |

## Accepted, no test
| case | closed by |
|---|---|
| A read during the deploy | RK-1 |
