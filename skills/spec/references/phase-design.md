# Design and lens review (phase 3, tiers M and L)

**Goal:** a design that meets every AC, with each trade-off recorded where it is made, checked by fresh reviewers
before anyone signs.
**Gate:** G-design. **User decision point:** DP3.

## Inputs

- intent.md: ACs, no-gos, glossary, and the `appetite` and `door` front matter.
- decisions.md, research (research.md, or the facts in architecture.md for M), answered questions.

## Steps

1. **architecture.md**, in its template's sections:
   - Overview: the shape of the change and the data flow, in 3 to 6 lines.
   - Components: what changes, where (`repo:path#Symbol`, never line numbers; add `(new)` after what a task will
     create), and which ACs and D-n it serves.
   - Contracts: the single home for every interface that crosses a boundary. Briefs link here; they never copy it.
   - Alternatives: only for real technical forks, one table per fork. A one-way or stakeholder fork keeps its options
     in decisions.md instead.
   - States and exits: each state, how it starts, how it ends, and what happens on failure or timeout.
   - Cross-cutting: security, personal data and logs, performance and cost, deploy, observability, old clients. One
     short paragraph or "none" each. M: the release order and the rollback go here, since M has no release.md.
   - Risks: `| RK-n | risk | likelihood | impact | mitigation or acceptance | owner |`. Words, not numeric scores.
     The mitigation names a test, a check, or the D-n that accepts the risk. Test ids do not exist until handoff, so
     describe the test in words ("a unit test that two calls write one event"); handoff adds the id.
2. **decisions.md.** One row per decision: `| D-n | decision | door | source, date | status |`, source `design`.
   One-way-door and stakeholder decisions also get a `### D-n options` block under Options: the options (✓ on the
   chosen one, "do nothing" included), Why, Cost / accepted risk, and Confirm by (a test in words, or a concrete check).
   Two-way decisions get the row only.
3. **Door check.** More than one one-way door means tier L. Each new one-way question becomes a card in the next card
   round (at most 5 cards), with `Blocks: G-design` or a later gate.
4. Run lint. Then run the lens review on the draft.
5. Record dispositions in review.md, fix the docs, run lint again. M: add review.md first if it does not exist:
   `node ~/.claude/skills/spec/scripts/new-spec.mjs --add review.md --slug <slug>`.
6. Hold DP3.

## Lens review

**Lenses.** Run these 3 by default:

- `security-data`: auth, permissions, personal data, secrets, retention, audit, logging of sensitive values.
- `contract-deploy`: API and schema contracts, compatibility across versions and clients (deprecated apps included),
  deploy order, migrations, rollback.
- `premortem`: "it failed in production a week after release; why?" Includes states and exits: stuck states,
  retries, timeouts, partial failure, duplicates.

Add `frontend` only when a PR changes a web or app UI: user flows; loading, empty, error and no-permission states;
copy against the glossary; the project's accessibility and translation rules.

**What each reviewer gets:** intent.md, decisions.md, architecture.md, its lens focus, and the design section of
`references/review-rubric.md`. research.md only to check evidence. Never review.md, so it does not anchor on old
findings.

**Appetite goes to every reviewer.** Tell each one the `appetite` and `door` lines and this instruction:
"Report only correctness or requirement gaps. Each finding needs a severity (blocker, major, minor), the AC or D it
affects, and evidence. Minor findings are optional. Do not ask for work the appetite rules out unless an AC fails
without it."

**How to run** (first option your tool supports):

- Claude Code with workflows: workflow `spec-lens-review`, started by name, with
  `{ "specDir": "<abs path>", "lenses": ["security-data", "contract-deploy", "premortem"] }`, plus `"frontend"` when
  there is a UI PR. It returns findings JSON.
- Subagents: one `spec-reviewer` per lens, in parallel when the tool allows.
- Neither: one headless `claude -p` run per lens (handoff-prompts.md section 3), or one fresh chat per lens, with the
  lens prompt in handoff-prompts.md. Never review your own design in the session that wrote it.

**One round.** A fix for a blocker triggers one re-run of that lens only. Its findings, new majors included, get
dispositions like the first round's; they never trigger a further round.

## Dispositions (review.md, Lens review table)

`| Lens | Severity | Finding | Cites | Evidence | Disposition |`

- Cites: the AC or D-n the finding touches. Rows have no ids.
- Disposition: `accepted: <what changed, where>`, or `rejected: <why>` with evidence, or `deferred to Q-n` or `RK-n`.
  Name a test in words; test ids come at handoff.
- A rejection needs evidence: a fact, a D-n, an AC, a no-go, or the appetite. "Not needed" is not evidence.
- Rejecting a finding is a normal outcome. Close reports the rejected share.
- An accepted finding that changes a decision gets a new D-n that supersedes the old one. Never rewrite the old row.

## DP3: what to show the user

- Each one-way-door decision with its options block. The user signs each one; set status `accepted`, source `user`.
- The two-way decisions in one table. The user accepts them in bulk, or picks out any to change.
- Blocker and major findings, with their dispositions.
- The new cards from this round, ready to send. The user sends them.

## Exit gate (G-design)

```
node ~/.claude/skills/spec/scripts/spec-lint.mjs <spec-dir>
node ~/.claude/skills/spec/scripts/drift.mjs <spec-dir> --strict
```

- Every one-way-door D-n is `accepted`, or blocked on a Q-n with `Default: NONE`.
- No blocker finding is open. Every major has a disposition.
- Every AC is met by a component or a contract in architecture.md.
- Lint reports 0 errors. Drift exits 0: every cited symbol is at the pinned refs (or marked `(new)`), none UNCHECKED.

## Common mistakes

- Option tables for two-way decisions. One row is enough.
- Restating a contract in decisions.md or a brief instead of linking `architecture.md#contracts`.
- A reviewer prompt that says "find gaps" without "only correctness or requirement gaps". It returns padding.
- Reviewing in the session that wrote the design.
- Accepting every finding without checking it, or rejecting without evidence.
- Commands in architecture.md. They belong in release.md (L) or the briefs.
- Forgetting a client named at intake, or designing for one nobody confirmed.
