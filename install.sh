#!/bin/sh
# Install the spec kit for Claude Code and Cursor by symlinking into ~/.claude (Cursor reads ~/.claude/skills and
# ~/.claude/agents through its third-party config import). Safe to re-run: existing correct links are kept, and a
# path that exists but is not our link is reported and left alone.
set -eu

KIT="$(cd "$(dirname "$0")" && pwd)"
CLAUDE_HOME="${HOME}/.claude"

link() { # link <source> <target>
  src="$1"; dst="$2"
  mkdir -p "$(dirname "$dst")"
  if [ -L "$dst" ]; then
    if [ "$(readlink "$dst")" = "$src" ]; then echo "ok      $dst"; return; fi
    echo "SKIP    $dst is a link to $(readlink "$dst"), not to $src (remove it yourself if you want ours)"; return
  fi
  if [ -e "$dst" ]; then echo "SKIP    $dst exists and is not a link (left alone)"; return; fi
  ln -s "$src" "$dst" && echo "linked  $dst -> $src"
}

link "$KIT/skills/spec" "$CLAUDE_HOME/skills/spec"
link "$KIT/agents/spec-reviewer.md" "$CLAUDE_HOME/agents/spec-reviewer.md"
for wf in "$KIT"/claude-only/workflows/*.js; do
  [ -e "$wf" ] || continue
  link "$wf" "$CLAUDE_HOME/workflows/$(basename "$wf")"
done

if [ ! -f "$KIT/local/environment.md" ]; then
  echo "NOTE    $KIT/local/environment.md is missing; create it with your machine facts (it is git-ignored)."
fi
echo "Done. Check: Claude Code lists /spec; in Cursor type /spec and confirm it appears once."
