---
spec: {{spec}}
ticket: {{ticket}}
tier: {{tier}}
status: {{status}}
---
# {{title}}: questions

<!-- Open questions only, as decision cards. A fresh context that has not read the code drafts them, so they read plainly. At most 5 per round. Every card has options with their consequences, a recommendation and a default. -->
<!-- Plain language in Context and option lines: at most 25 words per sentence, no backticks, terms from the intent.md glossary. Default NONE means a written yes is required; use it only when Blocks names a gate. -->
<!-- When a card is answered: delete it, add a row to Answered, and record the decision in decisions.md. -->

## Send list
<!-- Who gets which cards, by role. No names or emails. Sending stays manual. Example row: | product | Q-1 | | | -->
| Owner | Questions | Sent on | Channel |
|---|---|---|---|

## Open
<!-- Example card:
### Q-1 · Should page views from the mobile app be recorded?
Blocks: G-design · Default: B · Door: 2-way · Owner: product · Answer-by: {{date}}
Context: The web app will record each page a person opens. The mobile app is being retired.
A. Record mobile page views too: a complete history, but about one more week of work.
B. Record web page views only: ships sooner, and mobile visits leave no page-view event.  We recommend B because the mobile app is being retired.
If no answer by {{date}}, we build B.
-->

## Answered
<!-- One row per answered card: question id, → the decision id, date, role. -->
| Q | Answer | Date | Who |
|---|---|---|---|
