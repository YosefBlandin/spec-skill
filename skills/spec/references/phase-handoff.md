# Handoff (phase 4)

**Goal:** one short, self-contained brief per PR that a fresh executor can start without asking, and a locked folder.
**Gate:** G-handoff. **User decision point:** DP4.

## Inputs

All spec files so far, the profile (`task_prefix`, `base_branch`, `verify` and `test` per repo, human-only actions).

## Steps

1. **Tests.**
   - L: test-matrix.md rows `| T-AREA-n | traces | task | level | gate | check |`. Given/When/Then only for e2e and
     manual rows. An "Accepted, no test" table lists edge cases, or ACs, closed by a D-n or RK-n instead.
   - M: the same rows inside each pr-<repo>.md. S: inside spec.md.
   - Every AC traces to a test, or to an "Accepted, no test" row; lint checks it. Where design named a test in words
     (an RK mitigation, a Confirm by line), add the new test id there.
2. **Briefs.** One pr-<repo>.md per PR, from the template. S: the same parts live in spec.md, except Why, Glossary,
   Read first and the ALWAYS / ASK FIRST / NEVER block, which S skips. Fill:
   - Header: goal in one sentence, the AC and D ids, the absolute spec folder path, refs, worktree, branch and base
     (from the profile's Notes convention), brief version.
   - Read first: at most 5 items naming exact sections, for example `architecture.md#contracts`.
   - HUMAN needs: one `<HUMAN: …>` line per value or action only a person can supply, with the gate or task it blocks.
   - Global constraints: each D-n as `D-n: <one-line text copied verbatim>`, the commit and PR permission decision
     included; exact values the code needs; project rules by pointer (file and section).
   - ALWAYS / ASK FIRST / NEVER: ticket-specific lines first; keep the fixed lines.
   - Tasks: 8 to 15 (S: 2 to 6), in the task format from conventions.md. `<PREFIX>-0` records the baselines. Verify is
     the profile's `test.<repo>` filled with the task's test files, with the expected result; `verify.<repo>` runs in
     full at the baseline. Mark files and symbols a task creates with `(new)`. Tag `Judgment: high` for auth,
     concurrency, migrations and cross-repo contracts.
   - Tests (M only): this PR's test rows. Stop points and the hand-back section: keep the template's lines and add
     any ticket-specific stop points.
3. **Release.** L: write release.md as described in phase-release.md. M: the release order and rollback go in
   architecture.md Cross-cutting, and the human steps in each brief's HUMAN needs. S: the Release section of spec.md.
4. **Check.** Fetch each repo's base branch (`git -C <repo> fetch origin <base_branch>`), then run lint,
   `drift.mjs <spec-dir> --strict` and status. Fix every error. Cut text that breaks a budget.
5. **Cold-read dry run** for each PR (below). Fix and repeat, at most 2 rounds. If `cannot_start` items remain after
   round 2, stop and show them to the user, who either accepts each one in a D-n (source `user`) or allows one more
   round.
6. **DP4** (below), before the lock, so its answer is recorded before any file is locked.
7. **Lock.** Set status `locked-v1` in every file (the next version when you re-lock) and run the exit gate. Commit
   the folder if it is in git, on whatever branch the primary checkout has; executors read the spec folder by its
   absolute path, so it need not reach origin.
8. **Hand off.** Set status `executing` in every file, commit, and give the user the filled prompts from
   handoff-prompts.md, with the brief version (`locked-vN`). End the planning session.

## Required reading budget

intent.md + pr-<repo>.md + its Read first sections must stay under about 15k tokens per PR (characters / 4, HTML
comments left out). Lint and status count the first two; add the cited sections by hand. Over budget: move detail
behind a link, or split the PR.

## Cold-read dry run

An agent that tries to do the work finds more gaps than one that only judges it.

- **Fresh context:** a subagent, a headless session or a new chat, never the planning session.
- **Model:** cheaper than, or different from, the planner's. If a weaker model can start from the brief, the brief is
  good. In Cursor, the spec-reviewer runs on the session's model: for a different model, use a fresh chat and pick it
  in the picker. A fresh context is the minimum.
- **Inputs:** only intent.md, pr-<repo>.md and the sections the brief cites (S: spec.md alone). Read-only access to
  the repo at the pinned ref, to check that files, symbols and commands exist. No other spec files, no chat history.
- **Instruction:** "Walk each task in order as if you were about to do it. Do not write code." Use the cold-read
  checklist in review-rubric.md.
- **Output, four lists:**
  - `first_commands`: the first 10 commands it would run, in order.
  - `missing_values`: every value, credential, persona, permission or file it lacks, with the task id.
  - `assumptions`: every guess it had to make, with the task id.
  - `cannot_start`: every task it could not start without asking a person, with the reason. A task blocked only by
    a marked `<HUMAN: …>` need is a missing value, not `cannot_start`.
- **How to run** (first option your tool supports): workflow `spec-cold-read`, started by name, with
  `{ "specDir": "<abs path>", "repo": "<name>" }` (add `"repoPath": "<abs path>"` when spec_home is outside the
  repo); a `spec-reviewer` subagent with the cold-read prompt from handoff-prompts.md; a headless `claude -p` run of
  that prompt (handoff-prompts.md section 3); or a fresh chat with that prompt.
- **Dispositions:** each item becomes a brief fix, a `<HUMAN: …>` line, or "accepted" with a reason. Log each run in
  review.md, Cold-read log: brief, round, date, model class, the three counts, and where each item was fixed. M: if
  review.md does not exist yet, add it with `new-spec.mjs --add review.md --slug <slug>`. S: report the counts in chat.
- **Gate:** 0 `cannot_start` items, apart from those the user accepted in a D-n. The other lists are advisory, but
  each item needs a disposition.

## DP4: what to show the user

- The plan at a glance: release.md (L), or the brief headers and goals (S and M).
- The cold-read result per PR and the remaining `<HUMAN: …>` needs.
- The intake permission decision (Q6: commit on the task branch, push it, open a draft PR). Ask only to confirm or
  change it. If it changes, add a D-n with source `user` that supersedes it. Nothing else is granted: no merge, no
  ready-for-review, no promotion.

## Exit gate (G-handoff)

```
node ~/.claude/skills/spec/scripts/spec-lint.mjs <spec-dir>
node ~/.claude/skills/spec/scripts/drift.mjs <spec-dir> --strict
node ~/.claude/skills/spec/scripts/status.mjs <spec-dir>
```

- Lint reports 0 errors.
- Drift exits 0: every cited symbol is at the pinned refs and nothing is UNCHECKED. Fetch first; drift compares with
  `origin/<base_branch>`, or the local `<base_branch>` when there is no remote. Any change there is read and handled.
- The cold-read has 0 `cannot_start` items for every PR, apart from user-accepted ones.
- Required reading is under about 15k tokens per PR.
- Status is `locked-vN` in every file. The DP4 answer is recorded.

## Common mistakes

- "See architecture" without a section link.
- Pasting decision rationale into a brief. One line per D-n, verbatim.
- Tasks larger than one test cycle, tasks without a verify command, or verify commands not taken from the profile.
- No baseline task. A brief without the absolute spec folder path.
- Running the cold-read in the planning session, or on the same model without a fresh context.
- Keeping the planning session open to "help" the executor. Files are the only channel.
- A model or tool name written into the brief.
