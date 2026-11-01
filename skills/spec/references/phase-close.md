# Close (phase 7)

**Goal:** record what happened, measure whether the workflow helped, and turn repeat problems into kit changes.
About 10 minutes.
**Gate:** G-close. **User decision point:** approve the kit changes.

## Inputs

review.md (spec.md for S; M: add review.md with `new-spec.mjs --add review.md --slug <slug>` if it is missing),
every progress-<repo>.json, the hand-backs, the PRs and the release results.

## Steps

1. **Outcome** (review.md, Outcome; S: add a short Outcome section at the end of spec.md):
   - One line per AC: pass, fail or partial, and the check where it was verified.
   - The merge sha per repo.
   - Follow-ups as draft tickets. The user creates them. Each follow-up gets a new spec folder, never another plan in
     this one.
2. **Defects** (review.md, Defects table): every defect found after G-handoff, with its origin:
   - `spec-gap`: the spec was silent;
   - `spec-wrong`: the spec was wrong;
   - `executor`: the brief was right, the code was not;
   - `env`: tools, access or CI.
3. **Metrics** (review.md, Metrics table):
   - the user's minutes at DP1 to DP4 (ask; rough numbers are fine);
   - decision rounds after G-design: late answers that superseded a D-n;
   - lens findings: count, share rejected, and share that changed code;
   - cold-read `cannot_start` items, per round;
   - deviations and stop points hit;
   - folder size in tokens, and required reading per PR (the `tokens` line of `status.mjs`).
4. **Kit changes** (review.md, Kit changes). For each problem seen twice (in this ticket, or here and in an earlier
   close), one line: the problem, the defect or metric behind it, the proposal, and the kit file it changes.
   - Prefer a lint rule, which is deterministic, over a new instruction.
   - Prefer a template change that removes text over one that adds it.
   - Profile facts (commands, paths, human-only actions) go in the project's spec-profile.md, not the kit.
   - The user approves each proposal. Only then edit the kit, in its own commit.
5. **Behaviour delta (optional).** If the next ticket will touch this subsystem, write a short "how it behaves now"
   note in the owning repo's docs, following that repo's rules, through a PR. Otherwise skip it.
6. Tick the Definition of done in release.md (L). Set status `closed` in every file and commit.

## Exit gate (G-close)

```
node ~/.claude/skills/spec/scripts/spec-lint.mjs <spec-dir>
node ~/.claude/skills/spec/scripts/status.mjs <spec-dir>
```

- AC results, metrics and defect origins are recorded.
- Kit proposals are listed, or the outcome says "none".
- Status is `closed` in every file. Lint reports 0 errors.

## Common mistakes

- Saving lessons as personal memory notes instead of kit changes or profile entries.
- A proposal without evidence, or one that adds a paragraph to SKILL.md where a lint rule would do.
- Skipping the metrics because the ticket went well. The comparison needs every ticket.
- Adding follow-up work to this folder.
- Editing the kit before the user approves.
