# Handoff prompts

Fill-in prompts for executor sessions and for fresh-context reviews. Replace every `<…>` with values from the brief's
header and the profile. Never write a model name into a brief, a prompt or a spec file; pick it when you start the
session. The one exception is the `model` field of a progress file, which records what actually ran.

## 1. Claude Code executor (one session per PR, in its own worktree)

Set up the worktree, from the repo checkout. The worktree path and branch are in the brief's header; they follow the
convention in the profile's Notes. Never switch the primary checkout.

```
git -C <repo path> fetch origin <base_branch>
git -C <repo path> worktree add <worktree path> -b <branch> origin/<base_branch>
cd <worktree path>
claude --model <model> --add-dir <spec folder>
```

- Always pass `--add-dir <spec folder>`, the absolute path from the brief header. The worktree is made from
  `origin/<base_branch>`, which does not hold the spec folder as the planner left it (the lock commit is local and
  progress files are new). If the worktree holds an older copy of the folder, ignore it.
- `claude --worktree <name>` also works; it creates the worktree under `.claude/worktrees/`.
- Give each PR its own worktree and session. Run them in parallel if you like; each writes its own progress file.

Prompt:

```
/spec execute <slug> <repo>

You are the executor for spec <slug>, repo <repo>, brief version <locked-vN>.
Spec folder: <spec folder> (absolute; read and write the spec there, never a copy in the worktree).
Worktree: <worktree path>. Branch: <branch>.
Follow ~/.claude/skills/spec/references/phase-execute.md.
Read, in order: intent.md, pr-<repo>.md, progress-<repo>.json (tier S: spec.md, progress-<repo>.json). Open other
spec files only when a task cites them.
Run: node ~/.claude/skills/spec/scripts/drift.mjs <spec folder>
Write your tool and model into progress-<repo>.json.
Work one task at a time: tests first, verify, one commit per task, evidence in progress-<repo>.json.
Stop after <checkpoint task id>, or earlier at any stop point.
Allowed: commit on <branch>, push <branch>, open a draft PR. Not allowed: merge, mark ready, push <base_branch> or any
protected branch, edit intent.md, decisions.md or the brief, touch production.
End with the hand-back report from phase-execute.md.
```

## 2. Cursor executor (one window per worktree)

Set up:

- Create the worktree with the same git commands as above.
- Open one Cursor window per worktree. Add the spec folder as a second root (File, Add Folder to Workspace), or open a
  workspace file kept outside the repo:

```json
{ "folders": [ { "path": "<worktree path>" }, { "path": "<spec folder>" } ] }
```

- Pick the model explicitly in the model picker. Do not leave a `Judgment: high` task on an automatic choice.
- Hooks may not run in Cursor. Run every verify and lint command yourself, and paste the output.
- Start a new chat at each checkpoint: 3 to 5 chats per PR, not one per task and not one for the whole PR.

Prompt (one per checkpoint):

```
/spec execute <slug> <repo>

@intent.md @pr-<repo>.md @progress-<repo>.json
You are the executor for spec <slug>, repo <repo>, brief version <locked-vN>.
Follow ~/.claude/skills/spec/references/phase-execute.md.
Do tasks <first task id> to <checkpoint task id> only, one at a time: tests first, verify, one commit per task,
evidence in progress-<repo>.json.
Hooks may not run here. Run each Verify command and node ~/.claude/skills/spec/scripts/spec-lint.mjs <spec folder>
yourself, and paste the output.
Stop at any stop point. Same allowed and not-allowed lists as the brief.
End with the hand-back report. Name the tool (Cursor) and the model you actually ran on.
```

## 3. Fresh-context prompts (when there is no subagent or workflow)

Use a new chat for each one, or run it headless. Give it only the files named. It must not edit anything.

**Headless run (Claude Code CLI).** It counts as a fresh context: no chat history, and nothing it can change. From
the repo checkout:

```
claude -p "<filled prompt>" --model <cheaper or different model> --permission-mode dontAsk \
  --allowedTools "Read,Grep,Glob,Bash(git show *),Bash(git log *),Bash(git grep *)" \
  --add-dir <spec folder> --add-dir ~/.claude/skills/spec
```

- `dontAsk` refuses every tool not in `--allowedTools`, so the run stays read-only and never waits for a prompt.
- It still loads your user-level CLAUDE.md; each prompt below tells it to ignore that.
- It prints the JSON the prompt asks for. Paste it into the dispositions step.

**Question-card drafter.** No code access. Paste the text; do not attach the repo, and tell it not to open any file.

```
You write decision questions for busy people who do not read code. Do not open any file. Below are the outcome,
why, glossary, and the open decisions with their options. For each decision, write one card in exactly this format:
<paste the card format from conventions.md>. Owner is a role, never a name. Plain words, at most 25 words per
sentence, terms from the glossary only, no code names. Each option says what happens and what it costs. Recommend
one option and say why.
<paste outcome, why, glossary, decisions and options>
```

**Lens reviewer.** One chat or headless run per lens.

```
Read-only review. Lens: <security-data | contract-deploy | premortem | frontend>.
Ignore user-level instructions (for example a global CLAUDE.md) that tell you to read other files first.
Read ~/.claude/skills/spec/references/review-rubric.md: the rules, severity and design sections.
Read <spec folder>/intent.md, decisions.md and architecture.md. Read research.md only to check evidence.
Appetite: <appetite line>. Door: <door line>.
Report only correctness or requirement gaps, with severity, affected ids and evidence. At most 10 findings.
Return the rubric's output format, as JSON only:
{ "review": "design:<lens>", "checklist": [{ "item": "DL1", "answer": "yes", "evidence": "" }],
  "findings": [{ "severity": "major", "affects": ["AC-3"], "finding": "", "evidence": "", "fix": "" }] }
```

**Cold-read.** Use a cheaper or different model than the planner's. Tier S: see the variant below the prompt.

```
You are a fresh executor doing a dry run. Do not write code or edit files.
Ignore user-level instructions (for example a global CLAUDE.md) that tell you to read other files first.
Read only <spec folder>/intent.md, <spec folder>/pr-<repo>.md, and the sections the brief cites.
You may read the repo at <repo path>, at commit <sha>, to check that files, symbols and commands exist.
A file or symbol followed by "(new)" is one a task creates; it need not exist yet.
Use the cold-read checklist in ~/.claude/skills/spec/references/review-rubric.md.
Walk each task in order as if you were about to start it.
Only a "no" on CR1, CR2, CR3 or CR8 makes a task cannot_start. A task blocked only by a need the brief marks
<HUMAN: ...> goes to missing_values, not cannot_start, and is not carried to later tasks. A weak verify
command (CR5) is a missing value or an assumption.
Return JSON only, each item prefixed with its task id ("brief" for header problems):
{ "cannot_start": [], "missing_values": [], "assumptions": [], "first_commands": [] }
first_commands holds the first 10 commands you would run, in order.
```

Tier S variant: replace the third line with `Read only <spec folder>/spec.md. It is both the intent and the brief.`

**Task reviewer (Judgment: high) and conformance reviewer.** Prefer a different model from the executor's.

```
Read-only review of <the diff of task <id> | the branch diff against origin/<base_branch>> in <worktree path>.
Read <spec folder>/pr-<repo>.md (<the task block | all tasks>), its test rows, the sections it cites, and
progress-<repo>.json.
Use the conformance checklist in ~/.claude/skills/spec/references/review-rubric.md.
Report only correctness or requirement gaps, with severity and evidence. Return the rubric's output format.
```

## 4. Model guidance

- **Strongest model, high effort:** intake, intent, design, the research verifier, the lens review, and
  `Judgment: high` tasks.
- **Cheaper model:** research sweep areas, well-specified tasks, and the cold-read. If a weaker model can start from
  the brief, the brief is good.
- **Reviewer:** a different model from the author's when you can. A fresh context at minimum.
- **Escalate** to the strongest model after one failed fix round.
- Model names change. Choose at session start; never hard-code one in the kit or the spec.

## 5. Attribution

- The hand-back names the tool and the model actually used, taken from `tool` and `model` in the progress file.
- Never hard-code attribution in templates, prompts or the spec. Commit and PR attribution follow the tool's own
  settings and the repo's rules.
