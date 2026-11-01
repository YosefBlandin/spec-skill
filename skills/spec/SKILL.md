---
name: spec
description: Spec-driven feature workflow, run one phase at a time. Phases are intake, research, intent, design, handoff, execute, release and close, on a spec folder sized by tier (S, M or L), with a script gate at the end of each phase and fresh-context reviews where judgment is needed. Use when the user types /spec <phase> <ticket or title>, or asks to plan, hand off, execute, release or close a feature with a spec. Works in Claude Code and Cursor.
disable-model-invocation: true
metadata:
  version: "2"
---

# spec

Plan a change into a short spec folder, hand it to one executor session per PR, release it, and learn from it.
This file is the router. The formats live in `references/conventions.md`; if anything conflicts, conventions.md wins.
All paths below are under `~/.claude/skills/spec/`. Read a reference file only when its phase runs.

## 1. Read the request

The user writes `/spec <phase> <ticket or title>`, for example `/spec intake DEMO-12` or `/spec design qr-scanner`.

- Parse the phase and the ticket key or title from the user's message text. Never rely on argument substitution,
  shell-output injection or skill-folder variables. They are tool-specific, and Cursor does not support them.
- Phases: `intake`, `research`, `intent`, `design`, `handoff`, `execute`, `release`, `close`. Helpers: `status`, `lint`.
- Accept near words: `questions` → intent; `plan` → handoff; `build` or `implement` → execute; `retro` → close;
  `review` → design before the lock, or the conformance review during execute.
- A ticket key matches one of the profile's `ticket_prefixes`. Anything else is a title: turn it into a short kebab
  slug and confirm it with the user as one question in intake batch 1. It counts toward that batch's 4.
- `execute` also takes a repo name, for example `/spec execute DEMO-12 api`. If the profile has more than one repo
  and none is given, ask.
- If the phase is missing, run `status` and propose the next phase. If the ticket or title is missing, ask. Ask for
  both in one message.

## 2. Find the project profile

- Look for `spec-profile.md`, `specs/spec-profile.md` or `docs/specs/spec-profile.md` in the current directory, then
  in each parent. The scripts use the same search. If the user names a profile, pass `--profile <path>` to every script.
- Read it. It gives `spec_home`, the repos, the task prefixes, the base branches, the verify commands, the preflight
  checks and the human-only actions. If it names an `environment_file`, read that too. That file holds machine facts:
  use them, never copy them into a spec.
- No profile: draft one from `assets/templates/spec-profile.md`. Fill repos from `git rev-parse --show-toplevel`,
  verify commands from the repo's build files, and rule pointers from its CLAUDE.md or AGENTS.md. Show the draft and
  ask the user to confirm it before you write it. Ask where specs should live; never guess a home outside the repo.

## 3. Find the spec folder

- The folder is `<spec_home>/<slug>/`. `intake` creates it. Every other phase finds it by ticket key or slug under
  `spec_home`. If two folders match, ask. If none matches, offer `intake`.
- Start every phase with `node ~/.claude/skills/spec/scripts/status.mjs <spec-dir>`. It shows tier, status, files,
  lint, tokens and progress per repo. At intake no folder exists yet: run `status.mjs --all`.
- Read only the files the phase file lists. Chat history is not state; the files are.

## 4. Phases, gates and decision points

| Phase | Read first | Tiers | Exit gate (checkable) | User |
|---|---|---|---|---|
| intake | `references/intake.md` | all | G-intake: folder scaffolded at the right tier; door and appetite set (lint shows no door or appetite warning); intake answers recorded as D-n; preflight failures listed as `<HUMAN: …>`; lint 0 errors | DP1 |
| research | `references/phase-research.md` | M, L | G-research: refs pinned; every high-impact unknown points to a Q-n or a task; lint 0 errors | none |
| intent | `references/phase-intent.md` | all | ACs testable; no `[NEEDS CLARIFICATION]` without a Q-n; question cards complete; lint 0 errors | DP2 |
| design | `references/phase-design.md` | M, L | G-design: every one-way decision accepted or blocked on a Q-n; no open blocker finding; lint 0 errors; `drift --strict` exits 0 | DP3 |
| handoff | `references/phase-handoff.md` | all | G-handoff: lint 0 errors; `drift --strict` exits 0 (0 MISSING_AT_PIN, 0 UNCHECKED); cold-read 0 "cannot start" (or user-accepted); required reading under 15k tokens per PR; status `locked-vN` | DP4 |
| execute | `references/phase-execute.md` | all | every task verified with evidence; conformance review has no blocker; draft PR open | stop points only |
| release | `references/phase-release.md` | all | G-merge: CI green, no open Q-n blocks it. G-promote: staging checks pass | human actions |
| close | `references/phase-close.md` | all | G-close: outcome and metrics recorded; kit proposals listed; status `closed` | approve kit changes |

- **Entry:** the previous phase's gate passed. If the user wants to skip a phase, record the skip as a D-n.
- **Tier S** skips research and design. Intent writes the outcome, ACs and decisions into `spec.md`; handoff adds the
  tasks there. A one-way door is not S: move up a tier.
- **Tier words** are defined in conventions.md section 2: "data" is server or production data and its schema;
  "permissions" is access control. App runtime permissions, store-visible manifest changes and on-device settings
  are allowed at S, each recorded as a D-n.
- **Plan mode instead:** if the whole diff fits in one sentence, skip the folder and use the tool's plan mode.

The user has four planning decision points. Outside them, ask only to confirm setup at intake (slug, profile, spec
home, `--force`), at stop points, for release actions, and to approve kit changes at close.

- **DP1, intake:** answer at most 8 questions, in two calls of at most 4. About 10 minutes.
- **DP2, intent:** approve the ACs and no-gos. The user sends the stakeholder questions; the agent never does.
- **DP3, design:** sign each one-way-door decision one by one. Accept the two-way defaults in bulk.
- **DP4, handoff, before the lock:** approve the plan at a glance. Confirm or change the intake (Q6) decision on
  commit, push-branch and draft-PR permission; a change is a new D-n that supersedes it.

## 5. CRITICAL rules

1. **One home per fact.** Each fact lives in the file conventions.md names for it. Other files cite its id. A brief
   may copy a decision's one-line text verbatim; nothing else is restated.
2. **Ask early, ask few.** All intake questions come before research. At most 4 questions per call, each with 2 to 4
   options and a recommended default. Never ask what the ticket, the profile or the code already answers.
3. **Never self-grade.** The session that wrote a file does not judge it. Scripts check first. Judgment comes from a
   fresh context: the lens review, the cold-read and the conformance review. No numeric quality scores. Reviewers
   report only correctness or requirement gaps, with evidence.
4. **The executor never edits a D-n,** intent.md, decisions.md or its brief. It records a deviation in
   `progress-<repo>.json` and stops.
5. **Stop points.** Stop and hand back when a step would deviate from a D-n; a value is missing from the brief; verify
   is still red after 2 fix rounds; an edit falls outside the task's files; credentials or production access are
   needed; or the next step is a push to a protected branch, marking a PR ready, or a merge.
6. **Plain language for stakeholder text** (outcome, why, question cards): at most 25 words per sentence, no code
   names or backticks, terms from the glossary.
7. **Project rules become constraints, never copies.** Read the project's CLAUDE.md, AGENTS.md, rule folders and PR
   template. Record each rule that shapes this change as a constraint that cites the file and section, and plan the
   tasks it implies (for example "update the protocol doc and its log" before the code tasks). Never paste rule text.
8. **Gates are script steps.** Run the command and paste its output. Hooks are extras; they may not fire (in Cursor,
   for example).
9. **People send, agents draft.** Never send questions, messages or tickets for the user. Never merge, promote, mark a
   PR ready, or touch production. The profile's human-only list is binding.
10. **No secrets or personal data** in spec files, logs, tests or commit messages. Cite internal ids only.

**Late answer after the lock.** Add a new D-n that supersedes the old one. Run
`node ~/.claude/skills/spec/scripts/spec-lint.mjs <spec-dir> --impact D-<old>` to list the tasks and tests that cite
it. Update those and set status `locked-v<N+1>` in every file. Tell the user which executors must re-read which
tasks, then set `executing` again.

## 6. Scripts

Node 20 or newer, no install step. Each script finds the profile by walking up from the spec folder, then from the
current directory; pass `--profile <path>` when spec_home is outside the project.

```
node ~/.claude/skills/spec/scripts/preflight.mjs [--profile <path>] [--json] [--timeout <seconds>]
node ~/.claude/skills/spec/scripts/new-spec.mjs --tier S|M|L --slug <slug> [--ticket <KEY>] [--title "<text>"] [--repos <name,name>] [--profile <path>] [--force]
node ~/.claude/skills/spec/scripts/new-spec.mjs --add <file> --slug <slug> [--profile <path>] [--force]
node ~/.claude/skills/spec/scripts/spec-lint.mjs <spec-dir> [--profile <path>] [--json] [--impact <ID>]
node ~/.claude/skills/spec/scripts/drift.mjs <spec-dir> [--profile <path>] [--json] [--strict]
node ~/.claude/skills/spec/scripts/status.mjs [<spec-dir> | --all] [--profile <path>] [--json]
```

- `spec-lint` exits 1 on errors. Warnings (budgets, TODO, plain language) never fail; fix them or say why not.
- `preflight` exits 1 if a check fails. List each failure as a `<HUMAN: …>` need. Never fix access with credentials.
- `new-spec` prints the new folder path. Tier S takes exactly one repo in `--repos`. Pins are `origin/<base_branch>`,
  else the local base branch, else HEAD. `--add` renders one template (for example review.md, or pr-<repo>.md with
  its progress file and pin) into an existing folder. Use `--force` only after the user agrees; it overwrites.
- `drift` exits 1 on MISSING_AT_PIN, and with `--strict` also on UNCHECKED. A ref marked `(new)` is NEW: not checked.
  It never fetches; fetch the base branch first.
- `/spec status` runs `status.mjs --all`. `/spec lint <slug>` runs `spec-lint.mjs` on that folder. Paste the output.

## 7. Subagents, workflows and fallbacks

If you can spawn subagents (Claude Code), use the workflows and the `spec-reviewer` agent. Otherwise run the review
headless, do the work sequentially, or ask the user to open a fresh chat. Use the first column your tool supports.

| Job | Claude Code with workflows | Subagents (Claude Code or Cursor) | No subagents |
|---|---|---|---|
| Research sweep | workflow `spec-research` | one read-only subagent per area, then one verifier | do the areas one by one yourself |
| Question cards | n/a | one subagent given only the pasted text and told not to open any file | fresh chat, prompt in `references/handoff-prompts.md` |
| Lens review | workflow `spec-lens-review` | one `spec-reviewer` per lens | headless run or fresh chat per lens |
| Cold-read | workflow `spec-cold-read` | one `spec-reviewer` per PR, on a cheaper or different model | headless run or fresh chat per PR |
| Task review, conformance review | n/a | `spec-reviewer` | headless run or fresh chat |

- **Workflows** start by name (`spec-cold-read`), as install.sh links them into `~/.claude/workflows`. Never pass a
  path into the kit: the tool refuses paths outside the session's folders. With no Workflow tool, the skill of the
  same name cannot run either; use the next column.
- **Headless run:** `claude -p` with read-only `--allowedTools`, `--permission-mode dontAsk` and a cheaper or
  different `--model`, given the prompt from handoff-prompts.md section 3. It counts as a fresh context. Use it when
  no subagent is available, including non-interactive runs where nobody can open a chat.
- **Cursor:** the `spec-reviewer` runs on the session's model. For a different model, use a fresh chat and pick it
  in the model picker. A fresh context is the minimum.

Workflow inputs and outputs:

- `spec-research`: `{ "specDir": "<abs path>", "areas": [{ "key": "<area>", "focus": "<what to find>" }],
  "repos": { "<name>": "<abs path>" } }` returns markdown to merge into research.md.
- `spec-lens-review`: `{ "specDir": "<abs path>", "lenses": ["security-data", "contract-deploy", "premortem"] }`.
  Add `"frontend"` only when a PR changes a web or app UI. Returns findings JSON.
- `spec-cold-read`: `{ "specDir": "<abs path>", "repo": "<name>" }`, plus `"repoPath": "<abs path>"` when spec_home
  is outside the repo, returns `{ cannot_start, missing_values, assumptions, first_commands }`. Tier S works too: it
  reads spec.md as both intent and brief.

Only the main session talks to the user. Subagents return data; you decide and you ask. Reviews are read-only: the
reviewer never edits a file. The rubric for every review is `references/review-rubric.md`.

## 8. Asking the user

- Claude Code: use AskUserQuestion. At most 4 questions per call, 2 to 4 options each. Put the recommended option first
  and end its label with "(Recommended)". Subagents cannot call it; only the main session asks.
- Cursor, or no question tool: post a numbered list. Give each question's options as letters, mark the recommended
  one, and say "Reply with letters, for example 1B 2A. No reply on a question means its default."
- Record every answer in the spec at once. An answer that lives only in chat is lost.

## 9. Sessions

- **Planning session:** intake to handoff. It writes files and ends after DP4. It never executes.
- **Execution sessions:** one fresh session per PR, in its own worktree, started with a prompt from
  `references/handoff-prompts.md`. They write code and their own `progress-<repo>.json`, nothing else in the spec.
- If a planning session grows long, end the phase, and continue the next phase in a fresh session from the files.
- End every phase with: the gate output pasted, the files changed, the user's next decision, and the next phase.
- The playbook for people is `references/playbook.md`.
