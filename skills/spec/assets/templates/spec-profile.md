---
project: example                          # short name, shown by status.mjs
spec_home: .                              # where spec folders live: relative to this file's folder, or absolute
ticket_source: none                       # none | jira
ticket_prefixes: none                     # with jira: the keys, comma-separated, e.g. ABC, XYZ
repos: api=../api, web=../web             # name=path pairs, comma-separated, paths relative to this file
task_prefix.api: API                      # one per repo; task ids become API-0, API-1 ...
task_prefix.web: WEB
base_branch.api: main                     # one per repo; drift compares the pins with origin/<base_branch>, or the local branch
base_branch.web: main
verify.api: npm test; npm run lint        # one per repo; commands separated by ;, run in the worktree
verify.web: npm test; npm run lint
test.api: npm test -- {file}              # optional; runs one test file ({file}); a task's Verify uses it
test.web: npm test -- {file}              # a repo with two runners: test.<repo>.<kind>, e.g. test.app.dart
preflight: node --version => v; git --version => git version   # <command> => <text expected in the output>, separated by ;
environment_file: ~/spec-skill/local/environment.md             # optional; machine facts, never committed
# forbidden_strings_file: ../private/forbidden-strings.txt     # optional; spec-lint reports file:line only, never the match
---
# Spec profile: example

<!-- One per project, at most about 60 lines. The front matter is for the scripts: flat key: value lines, and no # inside a value, because # starts a comment. The prose below is for agents. -->
<!-- Never put personal data, company hosts or credentials here. They go in environment_file, which stays out of git. -->
<!-- The scripts find this file by walking up from the spec folder, then from the current folder. At each level they check spec-profile.md, specs/spec-profile.md and docs/specs/spec-profile.md. Pass --profile when spec_home is outside the project and you run a script from elsewhere. -->

## Rules to honour (pointers, not copies)
<!-- Where the project's own rules live. Intake turns the ones a change touches into constraints in intent.md. Never copy the rules here. -->
- api: CLAUDE.md, all sections.
- web: AGENTS.md, sections "Testing" and "Logging".

## Human-only actions
<!-- Actions the executor never takes. A check that needs a device, a login or credentials goes here, not in preflight. -->
- Merge a PR, mark it ready, promote between branches.
- Any check that needs a signed-in browser, a physical device or production access.
- Release signing and anything that touches a secret.

## Notes
<!-- What intake and handoff need: PR template paths, worktree and branch conventions, release order between repos. -->
- PR templates: api .github/pull_request_template.md; web .github/pull_request_template.md.
- Worktrees: a folder per spec beside the primary checkout; branch feature/<spec>. Never switch the primary checkout.
- Release order: web before api when both change.
