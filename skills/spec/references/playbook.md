# Spec playbook

For people. The agent's rules live in SKILL.md and the phase files; the formats live in conventions.md.

## Why this workflow exists

Feature planning with agents fails in the same few ways:

- Answers arrive after design and remove work that was already designed.
- Facts surface late: a deprecated app, the real risk appetite, missing access.
- Briefs are too long and too vague to execute without questions.
- One decision is restated in many files, and the copies drift.
- Environment facts live in one person's memory.

The answers: ask early and few; give each fact one home; keep briefs short; let scripts check what can be checked;
and use fresh-context reviews that try to do the work.

## Tiers

| Tier | Use when | Example |
|---|---|---|
| none | the diff fits in one sentence | fix a label typo: use plan mode, no folder |
| S | one repo, one PR, two-way door, no change to server data, access control or audit | add a sort option to a list screen; add a camera scan to an app |
| M | a contract or schema change, or two repos, or one low-risk one-way door | add a field to an API and show it in the web app |
| L | audit, security, production data, retention, access control, an ordered multi-repo release, or several one-way doors | log page views for audit across API and web, with retention |

"Data" means server or production data; "access control" means who may do what. An app's runtime permission or an
on-device setting is neither. Move up a tier at any time. Moving down needs a recorded decision.

## Your decision points

| Point | When | You do | Time |
|---|---|---|---|
| DP1 | intake | answer at most 8 questions with defaults | about 10 min |
| DP2 | intent | approve ACs and no-gos; send the stakeholder questions | 10 to 20 min |
| DP3 | design | sign each one-way door; accept two-way defaults in bulk | 10 to 30 min |
| DP4 | handoff | approve the plan at a glance; confirm commit, push and draft-PR permission | 5 to 10 min |

After DP4 you hear from the agents only at a stop point, and at release, where you act.

## Question rules

- Ask before design. Intake asks at most 8, in two rounds of up to 4.
- Every question has options, a recommended default, a door, an owner and a date: "If no answer by the date, we build B."
- A fresh agent that has not read the code drafts stakeholder questions, in plain words.
- One decision per question. Never ask what the code or the ticket already answers.
- A one-way door with no safe default gets `Default: NONE` and blocks a gate until someone says yes in writing.

## Trade-off rules

- **Door.** Two-way decisions are cheap to change: one line, decide fast, accept defaults in bulk. One-way decisions
  get options (with "do nothing"), a cost, a check that confirms them, and your signature.
- **Options.** Write them only for real forks. A table for every choice hides the ones that matter.
- **Appetite.** The time and risk budget set at intake. Reviewers get it, so they do not push work it rules out. If an
  AC cannot be met inside it, cut scope or change the appetite, as a recorded decision.
- **Late answers.** A new decision supersedes the old one. Lint lists what cites the old one. The brief gets a new
  version.

## Graders

- **Deterministic first:** lint, drift, preflight and the repo's own tests. They are cheap, repeatable, and never
  flatter.
- **LLM judgment only where needed:** the lens review at design, the cold-read at handoff, and the conformance review
  before the draft PR. Each runs in a fresh context, ideally on a different model, with a binary checklist, evidence
  required, and the instruction "report only correctness or requirement gaps".
- **Never:** a numeric quality score; the author grading its own work; a loop that rewrites until a judge is happy.
- **Expect holes.** LLM reviewers miss about half of what an expert finds, and rarely notice a wrong requirement.
  Your reviews at DP2 and DP3 cover that.
- **Later,** after about 10 tickets or before a teammate joins: replay 3 to 5 past tickets as regression evals, with
  mostly regex and file checks.

## Model choice

- The strongest model for planning, design, the lens review and `Judgment: high` tasks.
- A cheaper model for well-specified tasks and the cold-read.
- The reviewer on a different model when you can.
- Pick the model explicitly at session start. The hand-back records which one ran.

## Two-session protocol

- **Planning session:** intake to handoff. It writes files and ends after DP4. It never executes.
- **Execution sessions:** one per PR, in its own worktree, started fresh with a prompt from handoff-prompts.md. Each
  reads intent.md, its brief and its progress file, and writes only code and that progress file.
- **Files are the only channel** between sessions: decisions.md, the brief, `progress-<repo>.json`. Chat history is not.
- Two PRs can run in parallel, because each has its own progress file.
- The executor never edits a decision. It records a deviation and stops. You decide; the planning session records the
  new decision.

## What to measure at close

- Folder size and required reading per PR, in tokens.
- Decision rounds after design.
- Your minutes at DP1 to DP4.
- Lens findings: count, share rejected, share that changed code.
- Cold-read items and "cannot start" count.
- Deviations and stop points.
- Defects after handoff, by origin: `spec-gap`, `spec-wrong`, `executor`, `env`.

A problem seen twice becomes a lint rule or a template change in the kit, not a memory note.
