---
spec: {{spec}}
ticket: {{ticket}}
tier: {{tier}}
status: {{status}}
refs: {{refs}}
door: <1-way or 2-way, set at intake>   # the least reversible decision sets it
appetite: <set at intake>               # time and risk accepted, e.g. 3 days; a rollout gap of minutes is fine
---
# {{title}}

<!-- The executor reads this file. Outcome, Why and question cards are plain language: at most 25 words per sentence, no code spans, terms from the Glossary. Other files cite the ids defined here and never restate them. Examples sit in these comments; comments do not count toward the budget. -->

## Request (verbatim)
<!-- Pasted at intake, word for word: the ticket's acceptance criteria, or the user's request when there is no ticket. Remove personal data; keep internal ids. The intent phase turns it into AC rows. Do not edit it after intake. -->

## Outcome
<!-- What a named user can do or see after this ships, in 2 to 4 plain sentences. -->

## Why
<!-- The problem today and why it matters now: cost, risk, noise or a request. 2 to 4 bullets, with numbers where you have them. -->

## Acceptance criteria
<!-- Turn the Request into testable rows. One behaviour per row: "When <trigger>, the system shall <response>." (or While, or If ... then). From: ticket, a decision id or user. Ids are append-only; to retire one, start its statement cell with RETIRED. Example row: | AC-1 | When a user opens a page, the system shall write exactly one page-view event for that page. | ticket | -->
| AC | Statement | From |
|---|---|---|

## No-gos
<!-- What this work will not do, each with a one-line reason or the decision that settled it. -->

## Constraints
<!-- Project rules this change must honour, as pointers (file and section), and hard limits from intake. Never copy the rules here; the brief copies the values it needs. -->

## Glossary
<!-- Every term the plain-language text and question cards use. One line each. Example row: | page view | One visit to one page or named tab, recorded once. | -->
| Term | Meaning |
|---|---|

## Open questions
<!-- M tier only: at most 3 question cards here, in the questions.md card format, then one Send list line: owner role and question ids, no names. L tier: cards live in questions.md, so delete this section. -->
