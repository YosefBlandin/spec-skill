# Research (phase 1, tiers M and L)

**Goal:** collect the evidence design needs, pinned to commits, and turn every important unknown into a question or a
task. No design yet.
**Gate:** G-research. **User decision point:** none. The summary is shown at DP2.

## Inputs

- intent.md: the ticket ACs pasted at intake and its front matter.
- decisions.md: the intake D-n rows, especially clients (Q2) and the "not sure" answers.
- The profile: repos, paths and base branches.

## Steps

1. **Pin the code.** For each repo already named in refs (the repos intake chose):
   `git -C <repo> fetch origin <base_branch>` then `git -C <repo> rev-parse --short origin/<base_branch>`.
   Update `refs: <name>@<sha>, <name>@<sha>` in intent.md front matter. Read code at that commit: a clean worktree,
   or `git -C <repo> show <sha>:<path>`. If research shows another repo is touched, add it with
   `new-spec.mjs --add pr-<repo>.md --slug <slug>`, which writes its brief and progress file and pins it.
2. **Split into areas.** Two to six areas, each with one focus sentence. Examples: "write path", "read path", "other
   callers", "web screens", "deploy and config". M usually needs one or two.
3. **Run the sweep.** Use the first option your tool supports:
   - Claude Code with workflows: run workflow `spec-research`, started by name, with
     `{ "specDir": "<abs path>", "areas": [{ "key": "<area>", "focus": "<focus>" }], "repos": { "<name>": "<abs path>" } }`.
     It runs one read-only agent per area and one verifier, and returns markdown.
   - Subagents: one read-only subagent per area with the area prompt below, then one verifier subagent.
   - Neither: do the areas one at a time. Write each area's notes before you start the next.
4. **Verify.** A second pass re-reads the code for every fact that will become a decision or an AC. The workflow does
   this. Without it, use a verifier subagent, or ask the user to run the area prompt in a fresh chat for the riskiest
   area. Wrong facts go to the corrections table.
5. **Write it down.**
   - L: research.md, in its template's tables: Scope, Facts, Corrections, Assumptions, Unknowns, Live checks,
     Resolved from code. The workflow output already uses these tables; merge it and state corrected facts only.
   - M: the Facts table at the end of architecture.md (same columns as research.md). Keep only facts design will
     use, and cite them as `repo:path#Symbol`: line numbers live only in research.md.
6. **Sort unknowns.** A high-impact unknown goes to a Q-n (a person must decide), a task (an executor can safely find
   out) or a live check. A low-impact unknown becomes an assumption.
7. **Lint** and fix.

## What to record

- **Facts:** one per row, with the area and the evidence: `path:L<start>-<end>` (or `repo:path:L<start>-<end>` in a
  multi-repo spec) at the pinned ref. Add
  `repo:path#Symbol` when design will cite it. Give a fact an F-n id only when another file cites it; otherwise put
  `-` in the first cell.
- **Callers:** every client of the touched code, deprecated apps included, recorded as facts. Compare with the intake
  answer to Q2. A caller nobody named becomes a D-n or a Q-n, not a footnote.
- **Corrections:** the earlier claim (ticket, docs, a person), the resolved fact, and the evidence that settles it.
- **Assumptions:** importance and evidence, each high, medium or low, and the next step. High importance with low
  evidence needs a live check, a Q-n or a task.
- **Unknowns:** impact, and where each one goes: a Q-n, a task or a live check.
- **Live checks:** read-only commands and their results, with counts and internal ids only. Never write to a shared
  environment. A check that needs a login or production is a `<HUMAN: …>` line in release.md (L) or in the matching
  pr-<repo>.md HUMAN needs (M), not something you run.
- **Resolved from code:** questions a person might ask that the code already answers. These are never asked.

## Area prompt (subagent or fresh chat)

> Read-only. Do not edit files or run commands that change state. Repo `<name>` at `<path>`, commit `<sha>`.
> Area: `<key>`. Focus: `<focus>`.
> Report facts with `path:L<start>-<end>` at this commit, assumptions rated high, medium or low for importance and for
> evidence, unknowns with their impact, every caller of the code you read (old apps included), and questions the code
> already answers. Counts and internal ids only; no personal data.
> Do not propose a design. At most about 1.5k tokens.

## Exit gate (G-research)

```
node ~/.claude/skills/spec/scripts/spec-lint.mjs <spec-dir>
node ~/.claude/skills/spec/scripts/drift.mjs <spec-dir>
```

- `refs` is set in intent.md front matter: one `name@sha` per repo the spec touches. Adding a repo means adding its
  pr-<repo>.md.
- Every assumption with high importance and low evidence has a next step.
- Every high-impact unknown points to a Q-n or a task.
- Every caller is handled: in scope, or excluded by a D-n.
- Lint reports 0 errors. Budget warnings: cut text, do not argue with the budget.

## Common mistakes

- Line numbers outside research.md. Architecture and briefs cite `repo:path#Symbol`.
- Reading the moving branch instead of the pinned commit.
- Design proposals hidden in research. Keep them for the design phase.
- Missing callers. Search for the symbol across every repo in the profile, and in any deprecated app named at intake.
- Unknowns that never become a Q-n or a task, and then surface during execution.
- Long pasted code blocks. Cite them instead.
- Treating an unverified fact as settled because it reads well.
