# Spec conventions (the contract)

Every template, script and phase file follows this page. If something here conflicts with another file, this page wins.
`spec-lint` enforces the parts marked **[lint]**.

## 1. Where things live

- **Project profile:** `spec-profile.md`. The scripts find it by walking up from the spec folder, then from the
  current directory; pass `--profile` when spec_home is outside the project. It says where specs live (`spec_home`),
  which repos exist, the verify and test commands, the human-only actions and the forbidden-strings file. Format:
  section 6.
- **Spec folder:** `<spec_home>/<slug>/`.
  - `slug` is the ticket key plus a short kebab title when there is a ticket, for example `DEMO-12-page-view-logs`.
  - Without a ticket it is a short kebab title, for example `fdroid-qr-scanner`.
- **History:** git holds it. No "Update 2026-…" banners, no strikethrough. Superseded text moves to `archive/`, which
  lint ignores.

## 2. Tiers and files

| Tier | Choose when | Files |
|---|---|---|
| S | one repo, one PR, two-way door, no change to server data, access control or audit | `spec.md`, `progress-<repo>.json` |
| M | contract or schema change, or two repos, or one low-risk one-way door | `intent.md`, `decisions.md`, `architecture.md`, `pr-<repo>.md` and `progress-<repo>.json` (one each per PR); `review.md` when first needed |
| L | audit, security, prod data, retention, access control, multi-repo release order, or more than one one-way door | `intent.md`, `decisions.md`, `questions.md`, `research.md`, `architecture.md`, `test-matrix.md`, `pr-<repo>.md` and `progress-<repo>.json` per PR, `release.md`, `review.md` |

- **Words in this table.** "Data" means server or production data and its schema. "Access control" (permissions)
  means who may do what in the product. An app's runtime permission (camera, location), a manifest change that a store
  shows, and an on-device preference are neither: they are allowed at S. Record each as a D-n so reviewers see it.
- **Tier changes:** moving up a tier is always allowed. Moving down needs a decision (`D-n`).
- **Adding a file later:** `new-spec.mjs --add <file> --slug <slug>` renders one template into the folder (for
  example review.md for M). `--add pr-<repo>.md` also adds the progress file and the repo's pin in `refs`.
- **Small changes:** if the diff fits in one sentence, skip the folder and use the tool's plan mode.

**Token budgets [lint, warnings].** A token is counted as chars / 4. HTML comments (template guidance and examples)
do not count.

| File | Budget |
|---|---|
| `spec.md` | 2.5k |
| `intent.md` | 3k |
| `decisions.md` | 5k |
| `questions.md` | 4k |
| `research.md` | 12k |
| `architecture.md` | 12k |
| `test-matrix.md` | 7k |
| each `pr-<repo>.md` | 6k |
| `release.md` | 5k |
| `review.md` | 5k |

The executor's required reading is intent.md, its `pr-<repo>.md` and the Read first sections the brief cites (S:
spec.md). It should stay under 15k. Lint and `status.mjs` count only the first two; add the cited sections by hand.

## 3. Front matter [lint]

Every markdown file starts with a front-matter block made of flat `key: value` lines only: no nesting, no lists.

```
---
spec: DEMO-12-page-view-logs
ticket: DEMO-12             # or: none
tier: L                     # S | M | L
status: draft               # draft | locked-v1 | locked-v2 … | executing | closed
---
```

- **Required everywhere:** `spec`, `tier` and `status`.
- **Only in `intent.md` (or `spec.md`):**
  - `refs`: code pins, written as `refs: api@<sha>, web@<sha>`: one `name@sha` per repo this spec touches (the repos
    `new-spec --repos` chose). new-spec pins `origin/<base_branch>`, else the local base branch, else HEAD;
  - `door`: `1-way` or `2-way`;
  - `appetite`: free text, for example `3 days; rollout gap of minutes is fine`.
  - The templates ship `door` (above S) and `appetite` as `<…>` placeholders. Lint treats a `<…>` value as unset:
    a warning while draft, an error once locked. Intake replaces them.
- **Status must agree:** every file in a folder must have the same `status`.

## 4. Ids [lint]

| Family | Format | Home file (defined there) | S tier home |
|---|---|---|---|
| Acceptance criterion | `AC-1` | intent.md | spec.md |
| Decision | `D-1` | decisions.md | spec.md |
| Question | `Q-1` | questions.md (M: intent.md) | spec.md |
| Risk | `RK-1` | architecture.md | spec.md |
| Fact | `F-1` | research.md (M: the Facts table in architecture.md); only give an id when another file cites it | spec.md |
| Test | `T-<AREA>-<n>`, e.g. `T-POL-3` | test-matrix.md (M: pr-<repo>.md), written at handoff | spec.md |
| Task | `<PREFIX>-<n>`, prefix = the repo's `task_prefix` in the profile, e.g. `API-4`, `APP-2` | pr-<repo>.md | spec.md |

- **Definition.** An id is *defined* where it appears as the first cell of a table row (`| D-3 | …`) or at the start of a
  heading (`### Q-3 · …`, `### API-4 · …`), in its home file. Anywhere else, the id is a reference.
- **Uniqueness.** Each id is defined exactly once in the folder. Every reference must resolve to a definition.
- **Append-only.** Ids are never renumbered or reused.
- **No suffixes or ranges.** Not `D-3b`, `AC-1..3`, `AC-1–3` or `T-POL-1/2`. Write each id out.
- **Retiring an id.** Its definition row (or heading) keeps the id, and the next cell (or the heading title) starts with
  `RETIRED`, for example `| D-5 | RETIRED → D-12 |`. Citing a retired id anywhere outside its definition line is an
  error.
- **Before handoff** there are no test ids. Design names a test in words (in a risk mitigation, a Confirm by line or a
  review disposition); handoff writes the test row and puts its id in the RK row and the Confirm by line.
- **Gates** have names, not numbers: `G-intake`, `G-research`, `G-design`, `G-handoff`, `G-merge`, `G-promote`, `G-close`.

## 5. Formats

**Decision (decisions.md).** Each decision is a table row: `| D-n | decision | door | source, date | status |`.
- `door`: `1-way` or `2-way`.
- `source`: `intake`, `user`, `stakeholder:<role>` or `design`.
- `status`: `proposed`, `accepted`, `superseded-by D-m` or `RETIRED → D-m`.
- One-way-door and stakeholder decisions also get a block under the table: `### D-n options` with **Options**
  (✓ marks the chosen one; include "do nothing"), **Why**, **Cost / accepted risk** and **Confirm by** (a test, by id
  once handoff writes it, or a check).
- No other file restates a decision. A brief may copy the decision's one-line text verbatim.

**Question card (questions.md) [lint].**
```
### Q-9 · <short plain title>
Blocks: G-design · Default: B · Door: 2-way · Owner: product · Answer-by: 2026-10-12
Context: one or two plain sentences, no code names.
A. <option>: what happens and what it costs, in user terms.
B. <option>: what happens and what it costs.  We recommend B because …
If no answer by 2026-10-12, we build B.
```
- Field values:
  - `Blocks`: a gate name or `none`;
  - `Default`: an option letter, or `NONE`, meaning a written yes is required;
  - `Door`: `1-way` or `2-way`;
  - `Owner`: a role, never a person's name.
- `Default: NONE` is only valid when `Blocks` is not `none`.
- Once a question is answered, delete its card and add a row to the "Answered" table: `| Q-9 | → D-14 | date | who |`.
- Plain-language rules apply to the Context and option lines:
  - at most 25 words per sentence;
  - no backticks;
  - terms come from the glossary in intent.md.

**Acceptance criteria (intent.md).**
- Table: `| AC-n | statement | from |`.
- Behaviour is written as `When <trigger>, the system shall <response>.`, or with `While` or `If … then`.
- `from` names the source: a ticket AC number, a `D-n`, or `user`.

**Test row (test-matrix.md) [lint].**
- Table: `| T-AREA-n | traces | task | level | gate | check |`.
  - `traces`: AC or D ids;
  - `task`: a task id, or `manual`;
  - `level`: `unit`, `int`, `e2e` or `manual`;
  - `gate`: `G-merge`, `G-promote` or `none`;
  - `check`: one line. Given/When/Then is used only for e2e and manual rows.
- Put the test id in the real test's title so it can be found with grep.
- An "Accepted, no test" table lists edge cases, or ACs, that are closed by a D or an RK instead of a test.
- Coverage: every AC is in the traces of a test row or named in an "Accepted, no test" row, and every row's task is a
  task id or `manual`. Lint checks this once the first test row exists: warnings while draft, errors once locked.

**Task (pr-<repo>.md).**
```
### API-4 · <what this task delivers>
- Implements: AC-3, D-6 · After: API-2 · Judgment: normal | high
- Files: api:src/orders/list.ts#listOrders, api:src/orders/csv.ts#ordersToCsv (new), src/orders/csv.test.ts (new)
- Tests first: T-POL-3, T-POL-4
- Do: at most 5 bullets
- Verify: `<command>` → expected result
- Done when: verify is green, evidence is in progress-<repo>.json, and the reviewer has no blocker (Judgment: high only)
```
- Each task is one test cycle and one commit, about 150 changed lines or fewer.
- A PR has 8-15 tasks. S has 2 to 6, the baseline included.
- `<PREFIX>-0` records the baselines.
- Verify is the profile's `test.<repo>` command filled with the task's test files, plus the expected result. Without a
  `test.<repo>`, use a command the repo's build files define and name the file. `verify.<repo>` runs in full at the
  baseline and before the PR.

**Code references.**
- Briefs and architecture.md cite `repo:path#Symbol`, for example `api:src/orders/list.ts#listOrders`.
- A file or symbol that a task creates gets ` (new)` right after it: `api:src/orders/csv.ts#ordersToCsv (new)`, or a
  plain path such as `src/orders/csv.test.ts (new)`. Drift lists a reference marked (new) anywhere in the folder as
  NEW and does not check it, so later tasks may cite it without the mark.
- Line numbers appear only in research.md, as `path:L97-121`, or `repo:path:L97-121` in multi-repo specs (no #, so
  drift ignores it), pinned to the front-matter `refs`.

**Markers [lint].**
- `[NEEDS CLARIFICATION: Q-n]` must cite an existing question. A bare `[NEEDS CLARIFICATION]` is an error once status
  is `locked-*` or later.
- `<HUMAN: …>` marks a value or action only a person can supply. It is allowed only in `release.md`, `pr-*.md` and
  `spec.md`.
- `TODO`, `TBD` and `FIXME` produce warnings.

## 6. Project profile (`spec-profile.md`)

```
---
project: example
spec_home: .                          # relative to this file's folder, or absolute
ticket_source: none                   # none | jira
ticket_prefixes: none                 # e.g. ABC, XYZ
repos: app=../..                      # name=path pairs, comma-separated, paths relative to this file
task_prefix.app: APP                  # one per repo
base_branch.app: qa                   # used by new-spec (pins) and drift
verify.app: flutter analyze; flutter test; (cd android && ./gradlew ktlintCheck testDebugUnitTest)
test.app.dart: flutter test {file}    # optional; one test file; .<kind> only when a repo has two runners
test.app.android: cd android && ./gradlew testDebugUnitTest --tests {test}
preflight: flutter --version => Flutter; adb version => Android Debug Bridge; java -version => version
forbidden_strings_file: ../../private/company-strings.txt   # optional; relative to this file
environment_file: ~/spec-skill/local/environment.md          # optional
---
## Rules to honour (pointers, not copies)
## Human-only actions
## Notes
```

- `preflight` entries are `<command> => <text expected in the output>`, separated by `;`.
- `test.<repo>` (optional, or `test.<repo>.<kind>` per runner) runs one test: `{file}` is a test file path, `{test}` a
  test name. Tasks narrow Verify with it.
- The scripts find the profile by walking up from the spec folder, then from the current directory. At each level they
  check `spec-profile.md`, `specs/spec-profile.md` and `docs/specs/spec-profile.md`. Pass `--profile <path>` when
  spec_home is outside the project. Without a profile, lint warns that its forbidden-strings, refs and task-prefix
  checks were skipped.
- Entries whose command needs a device or credentials go under "Human-only actions" instead.

## 7. Roles and stop points

- **EXECUTOR** is the implementing agent; **HUMAN** is the user or the person they name.
- The executor never merges, marks a PR ready, promotes, pushes a protected branch, writes to cloud resources, reads
  production, enters passwords or edits a `D-n`.
- A deviation goes into `progress-<repo>.json` under `deviations`, and the executor stops.
- The executor reads and writes the spec folder at the absolute path in its brief header, never a copy in its worktree.

## 8. Progress file (`progress-<repo>.json`, written only by that PR's executor)

```json
{
  "spec": "<slug>", "repo": "api", "brief": "pr-api.md@locked-v1",
  "tool": "", "model": "",
  "baseline": { "tests": "", "lint": "", "typecheck": "" },
  "tasks": [ { "id": "API-0", "status": "todo", "commit": "", "evidence": [ { "cmd": "", "result": "" } ], "review": "" } ],
  "deviations": [ { "date": "", "task": "", "from": "D-6", "proposal": "", "decidedBy": "", "newDecision": "" } ],
  "surprises": [ { "date": "", "task": "", "what": "", "evidence": "" } ]
}
```

- `brief` is the version the handoff prompt names, `pr-<repo>.md@locked-vN` (spec.md for S), never `@executing`.
- `model` records the model that actually ran. It is the only place a model name is written in the spec folder.
- `status` is `todo`, `in_progress`, `done` or `blocked`.
- `review` is `""`, `pass` or `findings`.
- One file per repo means two executors running in parallel never write the same file.
