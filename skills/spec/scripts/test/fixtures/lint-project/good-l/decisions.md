---
spec: good-l
ticket: none
tier: L
status: draft
---
# Decisions

| id | decision | door | source, date | status |
|---|---|---|---|---|
| D-1 | Suppress plain reads and log page views instead. | 1-way | user, 2026-10-01 | accepted |
| D-2 | Ship both PRs in one release round. | 2-way | design, 2026-10-02 | accepted |
| D-3 | Keep a feature switch. | 2-way | design, 2026-10-02 | RETIRED → D-2 |

### D-1 options
- **Options:** ✓ suppress plain reads; keep logging every call; do nothing.
- **Why:** the rows then show what the user did.
- **Cost / accepted risk:** a read that matters must be listed by hand (RK-1).
- **Confirm by:** T-POL-1.
