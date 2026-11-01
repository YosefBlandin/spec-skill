---
spec: {{spec}}
ticket: {{ticket}}
tier: {{tier}}
status: {{status}}
refs: {{refs}}
door: 2-way                 # S is always 2-way; a 1-way door moves the spec to M
appetite: <set at intake>   # time and risk accepted, e.g. half a day
---
# {{title}}

<!-- S tier: one repo, one PR, two-way door, no change to server data, access control or audit (conventions.md section 2). If any of that stops being true, move up to M. This file is also the executor's brief. S skips a brief's Why, Glossary, Read first and ALWAYS / ASK FIRST / NEVER parts; the Stop section holds those rules. Stay under 2.5k tokens; comments do not count. Examples sit in these comments. -->

- Spec folder: <!-- absolute path of this folder; the executor reads and writes it here, never a copy in its worktree -->
- Worktree: <!-- absolute path, from the convention in spec-profile.md Notes -->
- Branch: <!-- from the profile convention --> · Base: <!-- origin/ plus base_branch for {{repo}} -->

## Request (verbatim)
<!-- Pasted at intake, word for word: the ticket's acceptance criteria, or the user's request. Remove personal data. -->

## Outcome
<!-- One or two plain sentences: what a user can do after this ships. No code names. -->

## Acceptance criteria
<!-- At most 5. One behaviour per row: "When <trigger>, the system shall <response>." (or While, or If ... then). From: ticket, a decision id or user. Example row: | AC-1 | When a user clicks Export, the system shall download a CSV of the rows on screen. | ticket | -->
| AC | Statement | From |
|---|---|---|

## Decisions
<!-- Every choice someone could reasonably make differently, intake answers included. Row: id, decision, door, source and date, status (proposed, accepted, superseded-by, RETIRED). Example row: | D-1 | Build the CSV in the browser; add no new endpoint. | 2-way | design, {{date}} | accepted | -->
| D | Decision | Door | Source, date | Status |
|---|---|---|---|---|

## No-gos
<!-- What this change will not do, one line each. -->

## Constraints
<!-- Project rules this change touches, as pointers (file and section), plus values the executor needs, copied in. -->

## HUMAN needs
<!-- One HUMAN marker per value or action only a person can supply, with the task it blocks. Preflight failures from intake land here. -->

## Tests
<!-- Row: id, traces (AC or D ids), task (a task id or manual), level (unit, int, e2e, manual), gate, one-line check. Every AC needs a row. Put the id in the real test title. Example row: | T-EXP-1 | AC-1, D-1 | {{prefix}}-1 | unit | G-merge | Two visible rows give a CSV with a header and two lines. | -->
| Test | Traces | Task | Level | Gate | Check |
|---|---|---|---|---|---|

## Tasks
<!-- 2 to 6 tasks, the baseline included. One test cycle and one commit each, about 150 changed lines or fewer. Verify: the profile's test.{{repo}} command with the task's test files, else verify.{{repo}}, pasted in, with the expected result. Mark a file or symbol the task creates with (new). Example task:
### {{prefix}}-1 · Export the rows on screen as CSV
- Implements: AC-1, D-1 · After: {{prefix}}-0 · Judgment: normal
- Files: {{repo}}:src/export/csv.ts#rowsToCsv (new), src/export/csv.test.ts (new)
- Tests first: T-EXP-1
- Do: write T-EXP-1 and see it fail; add rowsToCsv; wire it to the Export button.
- Verify: `<test command> src/export/csv.test.ts` → all pass, T-EXP-1 included
- Done when: verify is green and the evidence is in progress-{{repo}}.json
-->

### {{prefix}}-0 · Record the baselines
- Implements: none · After: none · Judgment: normal
- Files: none (no change)
- Tests first: none
- Do: create the worktree and branch above; run every verify command once, before any change.
- Verify: <!-- paste verify.{{repo}} from spec-profile.md --> → each result recorded in progress-{{repo}}.json, red or green
- Done when: the baseline is recorded and the worktree is clean

## Stop and hand back when
- A task would deviate from a decision. Record it under deviations in progress-{{repo}}.json first.
- A value is missing, verify is still red after 2 fix rounds, or a change is needed outside the task's Files.
- Credentials or production are needed, or the next step is a protected push, marking ready or a merge.
- The draft PR is open. Hand back from progress-{{repo}}.json: PR link, baseline vs final, deviations, surprises, tool and model.

Ask first before adding a dependency that no decision names, or running a command with side effects outside the worktree. The executor never merges, marks a PR ready, promotes, pushes a protected branch, writes to cloud resources, reads production, enters a password or edits a decision.

## Release
<!-- HUMAN steps only, each as a HUMAN marker: merge, checks that need a login, a device or production. Example: - <HUMAN: review and merge the PR, then check Export once on staging> -->

## Open questions
<!-- Rare at S. If one appears, write a question card in the questions.md format. If it blocks a gate, consider moving up to M. -->
