---
spec: forbidden
ticket: none
tier: S
status: draft
refs: api@0123abc
door: 2-way
appetite: 2 days
---
# Spec: health check host

## Outcome
Point the health check at the new host.

| id | statement | from |
|---|---|---|
| AC-1 | When the check runs, the system shall call the new host. | user |

## Notes
- The host is ZZ-ACME-INTRANET.EXAMPLE for now.
- The client is quokka holdings.
