---
spec: {{spec}}
ticket: {{ticket}}
tier: {{tier}}
status: {{status}}
---
# {{title}}: architecture

<!-- Design by component. Cite code as <repo>:<path>#<Symbol>, never with line numbers; the drift script checks these refs. Add (new) after a file or symbol that a task creates. Cite ACs and decisions by id and never restate them. Executors read only the sections their tasks cite, so each section must stand on its own. Examples sit in these comments. -->

## Overview
<!-- 3 to 6 lines: the shape of the change and the data flow. Add a small diagram only if it saves words. -->

## Components
<!-- One subsection per component that changes: what changes, where (<repo>:<path>#<Symbol>), which ACs and decisions it serves, and what stays the same. -->

## Contracts
<!-- The single home for every interface that crosses a boundary: endpoints, request and response shapes, events, stored row shapes, error codes. Briefs link here; they never copy a contract. -->

## Alternatives
<!-- Only for real technical forks, one table per fork under its own heading. Include the cost a reviewer would ask about. Record the chosen option as a decision in decisions.md and cite its id in the fork heading. A 1-way or stakeholder fork keeps its options in decisions.md instead. Example fork:
### Fork: where the new route lives (D-2)
| Option | Cost | Wiring | Verdict |
|---|---|---|---|
| A. Extend the main service | no new deploy; its config is near a size limit | none | rejected |
| B. A branch in an existing handler | one small change; mixes a write into a reader | branch on the route | viable |
| C. A new small service | one more deploy to watch | one route file and one registration | chosen |
-->

## States and exits
<!-- For anything with a lifecycle (jobs, sessions, retries, rollout windows): each state, how it starts, how it ends, and what happens on failure or timeout. The pre-mortem lens reviews this table. -->
| State | Entered when | Exits when | On failure or timeout |
|---|---|---|---|

## Cross-cutting
<!-- One short paragraph, or "none", for each: security and permissions; personal data and logs; performance and cost; deploy and infrastructure; observability; old clients. M tier: release order and rollback go here, because M has no release.md. -->

## Risks
<!-- Risks left after the design. Mitigation names a test, a check, or the decision that accepts the risk. At design, describe the test in words; handoff adds its id. Owner is a role. Example row: | RK-1 | Events written before the release have no page type, so the new filter misses them. | high | low | Accepted in D-1; old events expire on their own. | product | -->
| RK | Risk | Likelihood | Impact | Mitigation or acceptance | Owner |
|---|---|---|---|---|---|

## Facts
<!-- M tier only: the research facts design uses. L keeps facts in research.md, so delete this section. One fact per row; evidence is <repo>:<path>#<Symbol>, never line numbers. Give a row an F id only when another file cites it; otherwise put - in the first cell. Example row: | F-1 | write path | Every signed-in call writes one event after the response. | api:src/events/log.ts#writeEvent | -->
| F | Area | Fact | Evidence |
|---|---|---|---|
