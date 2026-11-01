---
spec: good-m
ticket: none
tier: M
status: draft
refs: api@0123abc, web@4567def
door: 2-way
appetite: 2 days
---
# Intent: page-view logs

## Outcome
Admins see one row for each page a colleague opens.

## Acceptance criteria
| id | statement | from |
|---|---|---|
| AC-1 | When a user opens a page, the system shall write one page-view row. | user |
| AC-2 | While a read is plain, the system shall not write a row for it. | D-1 |

## Open

### Q-1 · Do tabs count as pages
Blocks: none · Default: A · Door: 2-way · Owner: product · Answer-by: 2026-10-12
Context: Some pages have tabs.
A. Count pages only: fewer rows. We recommend A because it is simpler.
B. Count tabs too: more rows.
If no answer by 2026-10-12, we build A.

## Glossary
- Page view: one open of a page.
