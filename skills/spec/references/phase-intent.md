# Intent and questions (phase 2)

**Goal:** state what done means in testable terms, and put every open decision in front of the right person early,
with a default.
**Gate:** none by name; the exit check below. **User decision point:** DP2.

## Inputs

- intent.md (spec.md for S): front matter and the Request (verbatim) pasted at intake.
- decisions.md: the intake D-n rows.
- Research results (M and L): facts, unknowns, corrections.

## Steps

1. **Outcome:** two or three plain sentences in user terms. No code.
2. **Why:** at most 5 bullets. No code references.
3. **ACs:** a table `| AC-n | statement | from |`.
   - Write behaviour as "When <trigger>, the system shall <response>." Use "While <state>, …" or "If <condition>,
     then …" when they fit. One behaviour per row.
   - `from` names the ticket AC, a D-n, or `user`.
   - Rewrite only the vague ticket ACs. Keep clear ones close to the ticket's words.
   - Rough caps: S 5, M 10, L 20. More means the change should split.
4. **No-gos:** what this change will not do, each with a short reason.
5. **Glossary and constraints:** define each domain term once; stakeholder text uses only these terms. Check that
   intake listed each project rule this change touches under Constraints, as a pointer (file and section).
6. **Mark gaps:** where you would have to guess, write `[NEEDS CLARIFICATION: Q-n]` and create Q-n.
7. **Sort the open questions by owner.**
   - User-owned: ask now (at most 4 per call, options and a default). Record each answer as a D-n with source `user`.
   - Stakeholder-owned: write a decision card. L: questions.md, under Open. M: the Open questions section of
     intent.md, at most 3. S: rare; if a stakeholder answer blocks a gate, consider moving up to M.
8. **Draft the cards in a fresh context with no code access.** The session that read the code writes questions that
   are too technical. Give the drafter only the outcome, why, glossary, each decision in plain words, and the options
   with their consequences. Use a subagent given only that pasted text and told not to open any file, or the drafter
   prompt in handoff-prompts.md in a fresh chat. Then check the cards against the format and run lint.
9. **S tier:** write the outcome, ACs, no-gos and decisions into spec.md now. S skips Why and the Glossary; keep its
   text plain without them. Tasks come at handoff.
10. Run lint, then hold DP2.

## Question card (format from conventions.md)

```
### Q-9 · <short plain title>
Blocks: G-design · Default: B · Door: 2-way · Owner: product · Answer-by: 2026-10-12
Context: one or two plain sentences, no code names.
A. <option>: what happens and what it costs, in user terms.
B. <option>: what happens and what it costs.  We recommend B because …
If no answer by 2026-10-12, we build B.
```

- **Default:** a buildable option letter. Use `NONE` (a written yes is required) only for a one-way door that blocks
  a gate.
- **Answer-by:** from the intake deadline, leaving time to build the default.
- **Context:** what users or the business see, not how the code works.
- **Options:** each says what happens and what it costs. Include "do nothing" when it is a real choice.
- **Owner:** a role only. The user knows who holds it and adds the name when sending.
- **Batching:** at most 5 cards per round, highest impact first. L: fill the Send list in questions.md. M: add a Send
  list line under the Open questions in intent.md. Either way: owner role and question ids, no names or emails. The
  user sends them and fills in the date and channel.
- **Answered:** delete the card, add `| Q-9 | → D-14 | date | who |` to the Answered table, and add D-14 with source
  `stakeholder:<role>`.

## DP2: what to show the user

- The AC table and the no-gos, for approval.
- Research in five lines or fewer: corrections, callers found, top unknowns.
- The cards, grouped by owner and ready to send. The user sends them. Never post them anywhere yourself.

## Exit check

```
node ~/.claude/skills/spec/scripts/spec-lint.mjs <spec-dir>
```

- No `[NEEDS CLARIFICATION]` without a Q-n.
- Every card has Blocks, Default, Door, Owner and Answer-by, two or more options, a recommendation and the
  "If no answer by" line.
- Plain-language warnings on stakeholder text are fixed.
- The user approved the ACs and no-gos (DP2). Lint reports 0 errors.

## Common mistakes

- Questions written by the session that read the code. They come out technical. Use the fresh drafter.
- Asking what research already answered. Check "Resolved from code" first.
- Two decisions in one card, or a card with no recommendation.
- A default that cannot be built, or `Default: NONE` on a two-way door.
- ACs that describe implementation ("add a column") instead of behaviour.
- Process output in intent.md: coverage tables, readiness checklists. Those belong in lint output or review.md.
- Restating a D-n in intent.md. Cite its id.
