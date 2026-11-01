# Execute (phase 5)

**Goal:** one session per PR works through the task list, proves each task with evidence, stops at stop points, and
hands back a draft PR.
**User decision points:** none, except stop points.

## Before the first session

- The user starts one fresh session per PR, in its own worktree, with a prompt from handoff-prompts.md.
- As its last step after DP4 and the lock, the planning session sets status `executing` in every spec file and
  commits. The handoff prompt names the brief version. Each executor writes it into `brief` in its progress file, for
  example `pr-api.md@locked-v1`, never `@executing`.
- Two PRs may run in parallel. Each writes only its own `progress-<repo>.json`.

## Session start (every session)

1. Read, in this order: intent.md, pr-<repo>.md, progress-<repo>.json (S: spec.md and the progress file), from the
   spec folder path in the brief header, never a copy in the worktree. Open another file only when a task cites it.
2. Fetch first (`git -C <repo> fetch origin <base_branch>`), then run
   `node ~/.claude/skills/spec/scripts/drift.mjs <spec-dir>`. Drift checks `origin/<base_branch>`, or the local
   `<base_branch>` when there is no remote. A cited symbol missing there is a stop point; NEW refs are yours to create.
3. Write the tool and model you are actually running on into `tool` and `model`. Check them; never assume.
4. If `<PREFIX>-0` is not done, record the baselines (tests, lint, typecheck) in `baseline` and as its evidence.

## Task loop: one task at a time

1. Pick the first task with status `todo` whose After tasks are `done`. Set it `in_progress`.
2. **Tests first.** Write the task's listed tests, with the test id in each test title. Run them. They must fail, for
   the expected reason. Paste the failing output into evidence. A test that cannot fail first is a stop point.
3. **Implement,** touching only the task's Files.
4. **Verify.** Run the task's Verify command and paste the result into evidence. If it is red, fix it. After 2 fix
   rounds that stay red, stop.
5. **Judgment: high only.** A reviewer in a fresh context, ideally on a different model, checks the task's diff
   against the task block, the cited sections and the test ids. Use a `spec-reviewer` subagent, a headless run of the
   task-review prompt (handoff-prompts.md section 3), or ask the user to run that prompt in a fresh chat. A blocker
   counts as a fix round. Set `review` to `pass` or `findings`.
6. **Commit.** Tests and code together, one commit per task, following the repo's message rules, with the task id in
   the message. Put the commit sha in the task's `commit` field in progress-<repo>.json.
7. Set the task `done`. Add anything unexpected to `surprises`. Go to step 1.

**Checkpoints:** after the baseline, after the foundation tasks, and at the end of each task group. In Cursor, start a
new chat at each checkpoint (3 to 5 chats per PR). In Claude Code, start a fresh session when the context grows. The
progress file carries the state; chat history does not.

## Stop points

Stop and hand back when:

- a step would deviate from a D-n;
- a value is missing from the brief;
- verify is still red after 2 fix rounds;
- an edit would fall outside the task's Files;
- credentials or production access are needed;
- the next step is a push to a protected branch, marking the PR ready, or a merge.

When you stop, write the reason down first. A deviation from a D-n goes in `deviations`:

```json
{ "date": "2026-10-09", "task": "API-4", "from": "D-6", "proposal": "<one line>", "decidedBy": "", "newDecision": "" }
```

Anything else: set the task `blocked` and add the evidence. Never work around a stop point. Never edit a D-n,
intent.md, decisions.md or the brief. The user decides; the planning session writes any new D-n.

## Conformance review (before the draft PR)

- A fresh context, ideally on a different model: a `spec-reviewer` subagent, or a headless run or a fresh chat with
  the conformance prompt from handoff-prompts.md.
- Inputs: the branch diff against `origin/<base_branch>`, pr-<repo>.md, its test rows, the cited sections, and
  progress-<repo>.json.
- Checklist: the conformance section of review-rubric.md.
- A blocker is fixed in a new commit tied to a task, or it is a stop point. Report the result in the hand-back; the
  planning session copies it into review.md.

## Draft PR

Only if DP4 granted it. Push the task branch (never a protected one) and open a draft PR with the repo's PR template.
Never mark it ready. Never merge.

## Hand-back report

Build it from progress-<repo>.json. Do not write it from memory.

```
Hand-back · <spec> · <repo> · brief <version>
Tool and model: <tool>, <model>
PR: <link or "not opened">
Tasks: <done>/<total> done. Blocked: <ids or none>
Baseline → final: tests <a> → <b>; lint <a> → <b>; typecheck <a> → <b>
Conformance review: <pass, or counts by severity>
Deviations: <task, D-n, proposal> or none
Surprises: <one line each> or none
Still needs a person: <open HUMAN items> or none
```

## Exit check

```
node ~/.claude/skills/spec/scripts/status.mjs <spec-dir>
node ~/.claude/skills/spec/scripts/spec-lint.mjs <spec-dir>
```

- Every task is `done` with verify evidence, or `blocked` with a reason.
- The conformance review has no open blocker. The draft PR is open, if permitted.
- The hand-back is delivered. Lint still reports 0 errors.

## Common mistakes

- Editing a D-n, intent.md or the brief so the spec matches the code.
- Several tasks in one commit, or tests committed without the fail-first output in evidence.
- A third fix round instead of a stop.
- "While I'm here" edits outside the task's Files.
- Reading research.md or review.md "for context".
- Long sessions. Instruction-following drops as a session grows.
- "Done" without pasted verify output.
- A tool or model in the hand-back that you did not check.
