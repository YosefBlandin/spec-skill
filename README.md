# spec-skill

A kit for spec-driven feature work with coding agents. One portable skill, `/spec`, runs the same workflow in
Claude Code and in Cursor: intake, research, intent and questions, design, handoff, execute, release and close.
Scripts do every check that can be checked. Fresh-context reviewers do the rest.

Video walkthrough and write-up: https://yosefblandin.com/writing/spec-skill

## Layout

```
spec-skill/
  skills/spec/
    SKILL.md                 router: phases, gates, critical rules, script commands, fallbacks
    references/              conventions.md (the contract), playbook.md, intake.md, phase-*.md,
                             handoff-prompts.md, review-rubric.md
    assets/templates/        lean templates per tier, plus spec-profile.md
    scripts/                 new-spec, spec-lint, preflight, drift, status (Node 20+, no dependencies)
    scripts/lib/spec.mjs     shared parsing for the scripts
    scripts/test/            node:test tests and fixtures
  agents/spec-reviewer.md    read-only reviewer, loaded by Claude Code and Cursor
  claude-only/workflows/     optional Claude Code accelerators: spec-research, spec-lens-review, spec-cold-read
  local/                     git-ignored; environment.md holds your machine facts
  install.sh                 creates the symlinks
```

Start with `skills/spec/references/playbook.md` for the why, and `conventions.md` for the formats.

## Install

Needs Node 20 or newer, and git.

```
git clone https://github.com/YosefBlandin/spec-skill.git ~/spec-skill
cd ~/spec-skill
./install.sh
```

No git? Download the zip from the latest release, unpack it to `~/spec-skill` and run `./install.sh` there.

`install.sh` creates symlinks. It links single items, never a whole `.claude` folder. It is safe to re-run: it keeps
correct links and leaves alone any path that exists and is not its link.

- `~/.claude/skills/spec` → `skills/spec`
- `~/.claude/agents/spec-reviewer.md` → `agents/spec-reviewer.md`
- `~/.claude/workflows/<name>.js` → `claude-only/workflows/<name>.js`, one per workflow

Claude Code reads `~/.claude/skills` and `~/.claude/agents`. Cursor reads both too, through its third-party config
import, which is on by default. So one link serves both tools. Do not also link the skill into `~/.cursor/skills` or
`~/.agents/skills`; Cursor would list `/spec` twice. The workflows run only in Claude Code; the skill has a fallback
for every one of them.

Then:

1. Optional: write `local/environment.md` with your machine facts: accounts, guards, worktree convention, privacy
   rules. It is git-ignored. Point to it from `~/.claude/CLAUDE.md` in one line, and from each profile's
   `environment_file`.
2. Add a `spec-profile.md` to each project (template: `skills/spec/assets/templates/spec-profile.md`). If a project
   has none, `/spec intake` drafts one and asks you to confirm it.

## Use

```
/spec intake <TICKET-KEY or title>     questions, tier, scaffold
/spec research <slug>                  tiers M and L
/spec intent <slug>                    ACs, no-gos, question cards
/spec design <slug>                    architecture, decisions, lens review
/spec handoff <slug>                   briefs, cold-read, lock
/spec execute <slug> <repo>            in a fresh session per PR
/spec release <slug>
/spec close <slug>
/spec status                           every spec under the profile's spec home
```

The scripts also run on their own, for example:

```
node ~/.claude/skills/spec/scripts/spec-lint.mjs <spec-dir>
node ~/.claude/skills/spec/scripts/status.mjs --all
```

## Run the tests

```
cd ~/spec-skill/skills/spec/scripts
node --test
```

`node --test` with no path finds the test files under `test/`. Do not pass a folder path: newer Node versions treat
it as a file name.

## Verify in Claude Code

1. Type `/spec`. It appears once in the list.
2. In a project with a profile, run `/spec status`. It lists the specs, or none.
3. Optional: run `/spec intake DEMO-1` on a small past ticket with a fake key. It asks at most 4 questions per call,
   scaffolds the right tier, and runs lint. Send nothing anywhere.

## Verify in Cursor

1. Restart Cursor, since it reads `~/.claude` config at startup. In an Agent chat, type `/spec`. It must appear
   exactly once. If it appears twice, look for a copy in `~/.cursor/skills` or `~/.agents/skills` and remove the copy,
   not the symlink.
2. Run `/spec lint <slug>` on any spec folder. The agent runs `spec-lint.mjs` and pastes its output.
3. Open a multi-root workspace with a repo worktree and a spec folder. Ask the agent to read `intent.md` and a file in
   the repo. It can read both.
4. Check that `spec-reviewer` shows up as a subagent. It is read-only.

Hooks may not run in Cursor. The skill never depends on them: every gate is an explicit script step.

## Privacy

The kit holds no personal data, hosts, credentials or machine facts. Those live in `local/environment.md` and in each
project's profile. A profile committed to a public repo must stay public-ready; give it a forbidden-strings file and
lint checks every spec against it, reporting only `file:line`.

## Changing the kit

Change it through close-phase proposals: a lint rule or a template change, each with evidence from a real ticket.
Bump `metadata.version` in `SKILL.md` when behaviour changes.

## License

MIT. See `LICENSE`.
