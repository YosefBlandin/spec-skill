---
spec: good-l
ticket: none
tier: L
status: draft
---
# Brief: web

## Goal
Send one page-view call per page (AC-1).

## Tasks

### WEB-0 · Record baselines
- Implements: none · After: none · Judgment: normal
- Verify: `npm test` → baseline recorded in progress-web.json

### WEB-1 · Send page views
- Implements: AC-1 · After: WEB-0 · Judgment: normal
- Files: web:src/hooks/usePageView.ts#usePageView
- Tests first: T-PV-1
- Verify: `npm test` → green
- Done when: verify is green and evidence is in progress-web.json
