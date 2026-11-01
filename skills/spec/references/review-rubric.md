# Review rubric

Used by the `spec-reviewer` agent, the review workflows and fresh-chat reviewers. Every item is yes, no or unknown.
There are no scores.

## Rules for every review

- **Report only correctness or requirement gaps:** something that would make an AC fail, break a D-n or a contract,
  lose or leak data, block a rollback, or stop the executor. No style, no wording, no "nice to have".
- **Evidence is required.** Cite a file and section, a `path:line`, a command and its output, or one quoted line. No
  evidence, no finding.
- **Answer every checklist item** with yes, no or unknown. Say what you lacked for each unknown. A "no" becomes a
  finding unless it is minor.
- **Respect the appetite and door** in intent.md. Do not ask for work they rule out unless an AC fails without it.
- **Read-only.** Do not edit files. Do not run commands that change state.
- **Short:** at most 10 findings, most severe first. Minor findings are optional.

## Severity

- **blocker:** an AC or a D-n cannot be met as written; data could be lost or leaked; a one-way door has no recovery
  plan; or the executor cannot start. Fixed, or rejected with evidence, before the gate.
- **major:** a likely defect or rework: a missing test for an AC or a contract, an unhandled state, an unsafe rollout
  order. Fixed, or recorded with a reason.
- **minor:** a real gap with low impact. Optional to report and to fix.

## Output

```json
{
  "review": "design:<lens> | cold-read:<repo> | conformance:<repo> | task:<id>",
  "checklist": [ { "item": "DL1", "answer": "yes | no | unknown", "evidence": "" } ],
  "findings": [ { "severity": "blocker | major | minor", "affects": ["AC-3"], "finding": "", "evidence": "", "fix": "" } ]
}
```

The cold-read returns its four lists instead of `findings` (see below).

## Design lens review (DL)

Inputs: intent.md, decisions.md, architecture.md, the lens focus. research.md only to check evidence.

- DL1 Every AC is met by a named component or contract in architecture.md.
- DL2 Every one-way-door D-n has an options block with "do nothing", a cost and a confirm-by check.
- DL3 Each contract is defined once, in architecture.md, and every side that uses it cites it.
- DL4 Every client of the changed code, deprecated apps included, is handled or excluded by a D-n.
- DL5 Every persistent state has an exit for each actor, and a timeout where something can wait.
- DL6 Every mix of old and new versions that can exist during rollout keeps working.
- DL7 Each rollout step can be rolled back, or its D-n records that it is a one-way door, with a recovery plan.
- DL8 Who can read, write and delete each piece of data is stated, and nothing sensitive is logged.
- DL9 Retries, partial failures and duplicate requests have a stated behaviour.
- DL10 Each assumption with high importance and low evidence has a next step: a live check, a task or a Q-n.
- DL11 No D-n contradicts another D-n, an AC, a no-go or a project rule.
- DL12 Every risk has a mitigation that names a test (in words before handoff) or a check, or a D-n that accepts it.

Lens focus. Answer all items, but look hardest at these:

- `security-data`: DL8, DL9, DL11, plus authentication, permission checks, secrets, retention and audit.
- `contract-deploy`: DL3, DL4, DL6, DL7, plus migrations and config changes.
- `premortem`: DL5, DL9, DL12. First write the 3 most likely reasons it failed in production a week after release,
  then check each one against the design.
- `frontend` (only when a PR changes a UI): every user-visible AC has loading, empty, error and no-permission states;
  copy uses glossary terms; the project's accessibility and translation rules are cited.

## Cold-read (CR)

Inputs: intent.md, pr-<repo>.md, the sections it cites (tier S: spec.md alone, which is both), and read-only access
to the repo at the pinned ref. Answer per task.

- CR1 I can name the first command for this task.
- CR2 Every file and symbol the task names exists at the pinned ref, or the task marks it `(new)`.
- CR3 Every value the task needs is in the brief or a cited section. I do not have to guess.
- CR4 The tests to write are named, and I know what each one asserts.
- CR5 The verify command runs in this repo, and its expected result is stated.
- CR6 The task traces to an AC or a D-n.
- CR7 "Done when" can be observed without asking anyone.
- CR8 The tasks that must come first are named, and nothing unstated must happen first.
- CR9 Every credential, account, device or permission it needs is marked `<HUMAN: …>`.
- CR10 The project rules that apply are cited by file and section.

Only a "no" on CR1, CR2, CR3 or CR8 makes the task `cannot_start`. Other "no" answers, CR5 included, go to
`missing_values` or `assumptions`. A task blocked only by a need marked `<HUMAN: …>` is a "yes" on CR9: list the need
under `missing_values`, not `cannot_start`, and do not carry it to the tasks after it (their CR8 is "yes" when the
blocked task is named in After). Return `first_commands`, `missing_values`, `assumptions` and `cannot_start`, each
item prefixed with its task id, as JSON:
`{ "cannot_start": [], "missing_values": [], "assumptions": [], "first_commands": [] }`.

## Conformance review (CF)

Inputs: the branch diff against the base branch, pr-<repo>.md, its test rows, the sections it cites, and
progress-<repo>.json.

- CF1 Every task in the brief is done, or blocked with a recorded reason.
- CF2 Every test id in the brief appears in a test title, and the evidence shows it passing.
- CF3 Each commit maps to one task.
- CF4 Nothing changed outside the files the tasks list, or progress explains each exception.
- CF5 The code matches each cited D-n and contract: names, values and limits.
- CF6 No behaviour was added beyond the ACs, and no no-go was broken.
- CF7 Final results show no new test failures, lint errors or type errors against the baseline.
- CF8 No secrets, personal data or forbidden strings appear in code, logs, tests or commit messages.
- CF9 Every deviation is recorded, and none was applied without a decision.
- CF10 Verify evidence is pasted output, not a claim.

**Task review (`Judgment: high`):** apply CF2, CF4, CF5, CF8 and CF10 to the task's diff only.
