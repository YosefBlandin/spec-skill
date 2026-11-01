---
spec: good-l
ticket: none
tier: L
status: draft
---
# Brief: api

## Goal
Stop writing rows for plain reads (AC-2).

## Read first
- intent.md
- architecture.md, section Contracts

## Decisions (verbatim)
- D-1: Suppress plain reads and log page views instead.

## Tasks

### API-0 · Record baselines
- Implements: none · After: none · Judgment: normal
- Verify: `npm test` → baseline recorded in progress-api.json

### API-1 · Skip rows for plain reads
- Implements: AC-2, D-1 · After: API-0 · Judgment: high
- Files: api:src/libs/logger.ts#requestLogger
- Tests first: T-POL-1
- Verify: `npm test` → green
- Done when: verify is green and evidence is in progress-api.json

## Stop points
- A value missing from this brief: <HUMAN: name the owner>
