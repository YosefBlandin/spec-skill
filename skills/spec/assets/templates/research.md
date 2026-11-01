---
spec: {{spec}}
ticket: {{ticket}}
tier: {{tier}}
status: {{status}}
---
# {{title}}: research

<!-- Evidence only; the design lives in architecture.md. Read-only work: git show, git grep, read-only cloud calls. Line numbers are allowed only in this file, as path:L10-24 (repo:path:L10-24 in a multi-repo spec; no #, so drift ignores it), pinned to the refs in intent.md. Sections state corrected facts only. Examples sit in these comments. -->

## Scope
<!-- Areas covered, repos and refs read, and how this was produced (area sweep, then a verifier re-checks the facts that will become decisions). At most 3 lines. -->

## Facts
<!-- One verified fact per row, with evidence. Give a row an F id only when another file cites it; otherwise put - in the first cell. Example row: | F-1 | write path | Every signed-in call writes one event after the response. | api:src/events/log.ts:L97-121 | -->
| F | Area | Fact | Evidence |
|---|---|---|---|

## Corrections
<!-- Where two sources disagreed or an earlier claim was wrong: the claim, the resolved fact, and the evidence that settles it. Example row: | 1 | The docs say old events expire after 30 days. | Old events have no expiry set, so they never expire. | live check 1 | -->
| # | Earlier claim | Resolved fact | Evidence |
|---|---|---|---|

## Assumptions
<!-- What we believe but have not verified. Importance and evidence are high, medium or low. High importance with low evidence needs a live check, a question or a task. Example row: | Production has the same table shape as staging. | high | low | live check on production by a person | -->
| Assumption | Importance | Evidence | Next step |
|---|---|---|---|

## Unknowns
<!-- What nobody knows yet. Every high-impact unknown points to a question, a task or a live check. Example row: | Whether page views from the mobile app are needed. | high | Q-1 | -->
| Unknown | Impact | Goes to |
|---|---|---|

## Live checks
<!-- Read-only checks against real systems. Record counts, attribute names and internal ids only: never item values, names, emails or IPs. Example row: | 1 | Expiry on staging events | count events without an expiry (read-only) | 42 events have none | {{date}} | -->
| # | Check | Command or steps | Result | Date |
|---|---|---|---|---|

## Resolved from code
<!-- Questions someone would ask that the code already answers. Nobody re-asks these. -->
| Question | Answer | Evidence |
|---|---|---|
