---
project: lint-fixture
spec_home: .
ticket_source: none
ticket_prefixes: none
repos: api=./repos/api, web=./repos/web
task_prefix.api: API
task_prefix.web: WEB
base_branch.api: main
base_branch.web: main
verify.api: npm test
verify.web: npm test
forbidden_strings_file: forbidden-strings.txt
---
## Rules to honour (pointers, not copies)
None. This profile exists only for the spec-lint tests.

## Human-only actions
- Merges and promotions.
