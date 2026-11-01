---
spec: {{spec}}
ticket: {{ticket}}
tier: {{tier}}
status: {{status}}
---
# {{title}}: release

<!-- How the change reaches production and how it comes back out. Every gate and step has an owner: HUMAN or EXECUTOR. The executor never merges, promotes, reads production or decides a rollback. Examples sit in these comments. -->

## Plan at a glance
<!-- At most 8 numbered lines: PR order, merges, checks and promotions, each with its owner. The user approves this at the handoff decision point. -->

## Gates
<!-- Owner runs the check. Add rows for project-specific gates; keep the names from the conventions. -->
| Gate | When | Check | Owner | Pass when |
|---|---|---|---|---|
| G-merge | Before each PR merges | CI, conformance review, PR bot findings fixed or answered | EXECUTOR | All green and recorded on the PR |
| G-promote | Before promotion to production | Every staging and device check below | HUMAN | All pass and are recorded on the PRs |

## HUMAN needs
<!-- Values and actions only a person can supply, each as a HUMAN marker with the gate it blocks. Preflight failures from intake land here. The executor asks for these at the start and never invents them. -->
- <HUMAN: who promotes to production (role)> · Blocks: G-promote

## Staging and device checks
<!-- One row per check, citing its test ids. Fixtures use internal ids only. Checks that need a login, a device or a real gateway are HUMAN. Example row: | One page open writes one event | T-E2E-1 | staging | HUMAN | exactly one new page-view event | -->
| Check | Tests | Where | Owner | Pass when |
|---|---|---|---|---|

## Rollout order
<!-- Numbered steps with owner and the wait between them. Say what must never happen, for example one repo reaching production without the other. -->

## Rollback card
<!-- Decide this before the merge, not during an incident. -->
| Field | Value |
|---|---|
| Trigger | |
| Who decides | |
| Revert path | |
| Exposure window | |
| Verify after revert | |

## Definition of done
<!-- The close step ticks these. List each AC with the check where it passed, for example: - [ ] AC-1 passes on production (T-E2E-1). -->
- [ ] Every AC passes, each with the check where it passed.
- [ ] Follow-up tickets are drafted for every deferred item.
- [ ] review.md outcome and metrics are filled, and every file's status is closed.
