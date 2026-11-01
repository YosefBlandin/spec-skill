# Intake (phase 0)

**Goal:** learn in one short sitting everything that would otherwise arrive late, and pick the tier.
**Gate:** G-intake. **User decision point:** DP1, about 10 minutes.
**Inputs:** the ticket (or the user's request), the profile and the environment file it names, and the project's own
rules: CLAUDE.md, AGENTS.md, rule folders, PR templates.

## Steps

1. Read the ticket with the tracker tool the session has. If there is none, ask the user to paste it. Keep its
   acceptance criteria word for word.
2. Run preflight and keep the output: `node ~/.claude/skills/spec/scripts/preflight.mjs`
3. Read the project rules. List the ones this change could touch. Do not copy them.
4. Skim the code just enough to propose a tier and pre-fill defaults. Note what the code already answers.
5. Ask batch 1 (Q1 to Q4). Then scaffold the folder at the chosen tier, passing only the repos this change touches
   (S: exactly one). The slug is `<KEY>-<short-kebab-title>` with a ticket, or just the kebab title without one:
   `node ~/.claude/skills/spec/scripts/new-spec.mjs --tier <tier> --slug <slug> [--ticket <KEY>] --repos <names>`
6. Ask batch 2 (Q5 to Q8). Record every answer (below). Paste the ticket's ACs, or the user's request, word for word
   under Request (verbatim) in intent.md (spec.md for S); the intent phase turns them into AC-n rows.
7. Run lint, fix errors, and report: tier and reason, the D-n list, the HUMAN needs, the next phase.

## Question rules

- At most 8 questions, in two calls of at most 4. Fewer is better. Drop any question that the ticket, the profile or
  the code already answers, and say which source answered it.
- Without a ticket, confirming the slug is one question in batch 1. It counts toward the 4 and the 8: drop or defer
  the question whose default the evidence supports best.
- Each question has 2 to 4 options and a recommended default with a one-line reason. Pick it from evidence; when
  evidence is thin, pick the cautious option. The letters below name options, not an order: when you ask, put the
  recommended option first and end its label with "(Recommended)".
- Plain words, one decision per question, no code names. Only the main session asks; a subagent may draft options.
- For a request that looks like S, ask only Q1, Q2, Q3 and Q6 unless an answer raises the tier.

## Batch 1: what it touches, and how risky it is

**Q1 · Size.** "What does this change touch?" Recommend the tier the code skim supports.
- A. One repo and one PR. No change to server data, access control or audit. (Tier S)
- B. An API contract or a server data schema, or two repos. (Tier M)
- C. Audit, security, production data, retention, access control, or an ordered release across repos. (Tier L)
- D. Not sure yet. Research first, then I propose a tier.

App runtime permissions, store-visible manifest changes and on-device settings fit S, as a D-n (conventions.md 2).

**Q2 · Clients and apps.** "Which apps or clients use the code this change touches?" Always ask this. A forgotten
old app is the most common late discovery. Recommend D when the touched code is shared, otherwise A.
- A. Only the current apps in the profile.
- B. Also an old or deprecated app that is still live. Name it.
- C. Also outside callers: partners, scripts or integrations.
- D. Not sure. Research lists every caller before design.

**Q3 · Risk appetite and door.** "If this goes wrong after release, how do we undo it?" Recommend from the code and
the ticket; when evidence is thin, the less reversible answer.
- A. Revert the PR. No data or user harm. (Two-way door)
- B. Revert plus a cleanup step, such as a data fix. (One-way door, small blast radius)
- C. It cannot be fully undone: production data, audit records, permissions, or messages already sent. (One-way door)

**Q4 · Rollout tolerance.** "How may this reach users?" Recommend A for one repo, B for a contract across repos.
- A. All parts at once. A gap of minutes between deploys is fine.
- B. In a fixed order, for example the server first. Short gaps are fine.
- C. Behind a flag, or as a staged rollout.
- D. In a planned window, with a person watching.

## Batch 2: who, where and when

**Q5 · Environment and access.** "What may the agent run, and where?" Recommend A.
- A. Local tests and builds only. A person runs every staging or live check.
- B. Also read-only checks on a shared test environment, with access the user already has.
- C. Also runs on a connected device or hardware.
- D. Something needs production access. A person does that part.

**Q6 · Who does what.** Recommend A.
- A. The agent writes code, commits and opens draft PRs. A person reviews, merges and promotes.
- B. The agent writes code and commits. A person pushes and opens PRs.
- C. The agent writes code only. A person commits.
- D. A person writes some of the code. Name the parts.

**Q7 · Stakeholders and deadline.** "Who must agree, and by when?" Recommend A unless the ticket names roles or a date.
- A. Only me. No fixed date.
- B. Only me, with a fixed date. Give the date.
- C. Other roles must answer questions. Name the roles, for example product, infra or security.
- D. Other roles, and a fixed date.

**Q8 · Project rules.** "Besides the rules I found (list them), does anything else apply?" Recommend A when the list
came from the repo's own files.
- A. No. The list is complete.
- B. Also a clean-room or provenance rule: some sources must not be read, or every source must be logged.
- C. Also a public-repo rule: no company names, hosts or private strings in anything committed.
- D. Something else. Describe it.

## Recording answers

- **Tier:** new-spec sets `tier`; add a D-n with the reason. Moving down later needs a new D-n.
- **Door and appetite (Q3, Q4, Q7 date):** replace the `<…>` placeholders in intent.md front matter (spec.md for S),
  their only home, for example `door: 1-way` and `appetite: 3 days; server first, gaps of minutes are fine`. If nobody
  gave a time budget, propose one from the tier and the date, and confirm it in the intake summary. Not a D-n.
- **Q2, Q5, Q6 and Q7** each become one D-n row with source `intake`, also when the ticket, the profile or the code
  answered it unasked (then name that source in the text). A default taken without a reply ends with "(default)":
  `| D-2 | Clients: web app and the old mobile app v3, still live | 2-way | intake, 2026-10-05 | accepted |`
- **Project rules (Q8 and step 3):** one pointer line per rule this change touches (file and section, never the rule
  text) under Constraints in intent.md (spec.md for S); plan the work it implies. Use words, not `repo:path#Symbol`:
  `- Clean-room rule: app repo, CLAUDE.md, section "Clean room". Protocol doc changes and their log come before code.`
- **Roles and dates (Q7)** become the Owner and Answer-by of later cards. **"Not sure" answers** become research areas
  or unknowns (M and L); for S, ask once more or move up a tier.
- **Preflight failures and access gaps (Q5):** one `<HUMAN: …>` line each, in release.md HUMAN needs (L), the matching
  pr-<repo>.md HUMAN needs (M), or spec.md HUMAN needs (S). The D-n rows live in decisions.md (M, L) or spec.md (S).

## Exit gate (G-intake)

Run `spec-lint.mjs <spec-dir>` and `status.mjs <spec-dir>` from `~/.claude/skills/spec/scripts/`. Paste the output.

- The folder exists at the chosen tier. Lint shows no `door` or `appetite` warning, so both are set.
- Every intake answer is in the spec: a D-n with source `intake`, front matter, or a Constraints line.
- Every preflight failure is a `<HUMAN: …>` line. Lint reports 0 errors.

## Common mistakes

- Asking before reading the ticket and the code, or asking what the code answers. More than 4 questions in one call,
  or a question without options and a default. Skipping Q2 because the answer seems obvious.
- Leaving answers in chat: if it is not in the spec, it did not happen. Copying CLAUDE.md or AGENTS.md text instead
  of citing it. Trying to fix a preflight failure with credentials: it is a HUMAN need.
