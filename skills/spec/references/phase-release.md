# Merge and release (phase 6)

**Goal:** get the merged change to users safely, with every human step named and a rollback ready before it is needed.
**Gates:** G-merge, G-promote. A person acts. The agent prepares, and checks read-only.

## Inputs

- L: release.md. M: the HUMAN needs in each brief, and the release order and rollback in architecture.md
  Cross-cutting. S: the Release section of spec.md.
- The hand-back reports, the PRs, and the profile's human-only actions.

## release.md (written at handoff, used here)

- **Plan at a glance:** at most 8 numbered lines: PR order, merges, checks and promotions, each with its owner.
- **Gates:** `| Gate | When | Check | Owner | Pass when |`, with owner `HUMAN` or `EXECUTOR`.
  - G-merge: CI green on each PR; conformance review clean; no open Q-n with `Blocks: G-merge`; PR bot findings
    fixed or answered.
  - G-promote: every staging and device check passed; rollout preconditions met.
- **HUMAN needs:** one `<HUMAN: …>` line each, with the gate it blocks. Preflight failures from intake land here.
- **Staging and device checks:** `| Check | Tests | Where | Owner | Pass when |`. A person can follow each one without
  asking: persona, test data by internal id, what to do, what to see. Checks that need a login, a device or a real
  network are HUMAN.
- **Rollout order:** numbered steps with owner and the wait between them. Say what must never happen, for example one
  repo reaching production without the other.
- **Rollback card:** Trigger (the signal and threshold), Who decides (a role, and how fast), Revert path (what, in
  which order), Exposure window, Verify after revert. Name what a revert does not undo: data written, messages sent,
  migrations run, and the plan for each.
- **Definition of done:** each AC with the check where it passed, follow-ups drafted, review.md outcome filled.

## Human-only steps (the agent never does these)

- Merge, mark ready, promote, deploy.
- Logged-in checks on shared environments; anything that touches production or its data.
- Device runs, real-network or hardware tests, release signing, store uploads, as the profile lists.
- Approving deviations, and accepting findings that change a D-n.
- Sending messages to stakeholders.

## Steps

1. Build the gate checklist from release.md (or the M and S equivalents) and the hand-backs. Copy each hand-back's
   conformance result into review.md, Conformance review table.
2. Fill in the evidence the agent can read: CI status, PR checks, review comments. Read-only commands only.
3. PR bot or reviewer comments: an executor session fixes each one in a new commit tied to a task, and re-runs
   verify. If a comment is wrong, the person records why on the PR.
4. Ask the person to merge, in the release order. Note the merge sha per repo for the close.
5. Give the person the staging and device checks in order. Each result (pass or fail, who, when) is recorded on the
   PR.
6. If every check passes, the person promotes. If a check fails, stop: use the rollback card, or open a fix task. A
   fix that changes behaviour needs a new D-n first.
7. After promotion, the person watches the trigger signal for the agreed time.

## Exit gates

```
node ~/.claude/skills/spec/scripts/status.mjs <spec-dir>
node ~/.claude/skills/spec/scripts/spec-lint.mjs <spec-dir>
```

- **G-merge:** CI is green, the conformance review is clean, and no open Q-n blocks G-merge.
- **G-promote:** every staging and device check passed and is recorded on the PRs.
- Lint reports 0 errors.

## Common mistakes

- A rollback card written after the incident.
- "Revert the PR" as the rollback for a one-way door.
- Staging steps without a persona, test data or an expected result.
- The agent running merge or promote commands "to save time".
- Behaviour changes made during release without a new D-n.
- Release steps spread across files. They live in release.md (L), architecture.md Cross-cutting plus the brief (M),
  or spec.md (S), nowhere else.
