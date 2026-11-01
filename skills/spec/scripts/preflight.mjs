#!/usr/bin/env node
// Run the project profile's preflight checks and check that each profile repo is a git repo.
// See ../references/conventions.md section 6 for the `preflight:` format (`<command> => <expected text>; ...`).
//
// usage: node preflight.mjs [--profile path] [--json] [--timeout seconds]
// Exit 1 if any check fails. Output is truncated and redacted; environment variables are never printed.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { parseArgs, profileFor } from './lib/spec.mjs';

const USAGE = 'usage: preflight.mjs [--profile path] [--json] [--timeout seconds]';
// Run checks with the caller's inherited environment (no login shell): executors run their commands with the PATH of
// the session that started them, and a login shell would skip ~/.zshrc additions such as a Homebrew JDK.
const SHELL = existsSync('/bin/zsh') ? ['/bin/zsh', '-c'] : ['/bin/sh', '-c'];
const MAX_DETAIL = 120;
const MAX_CAPTURE = 1 << 20;

// Patterns that look like credentials. Matches are replaced before anything is printed.
const SECRET_PATTERNS = [
  [/\b(?:gh[pousr]|github_pat)_[A-Za-z0-9_]{12,}/g, '[redacted]'],
  [/\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g, '[redacted]'],
  [/\bxox[abprs]-[A-Za-z0-9-]{8,}/g, '[redacted]'],
  [/\bsk-[A-Za-z0-9_-]{12,}/g, '[redacted]'],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{4,}/g, '[redacted]'],
  [/(^|[\s'"])([A-Za-z_][A-Za-z0-9_]*)=\S+/g, '$1$2=[redacted]'], // NAME=value, as printed by env or export
  [/\b((?:token|secret|password|passwd|api[_-]?key|access[_-]?key|session)\w*\s*[:=]\s*)\S+/gi, '$1[redacted]'],
  // Long opaque strings with both letters and digits (keys, tokens). Paths are split by / and survive.
  [/(?=[A-Za-z0-9+_-]*\d)(?=[A-Za-z0-9+_-]*[A-Za-z])[A-Za-z0-9+_-]{32,}={0,2}/g, '[redacted]'],
];

function redact(text) {
  let out = text;
  for (const [re, rep] of SECRET_PATTERNS) out = out.replace(re, rep);
  return out;
}

/** One line, redacted, at most MAX_DETAIL characters. */
function detailOf(text) {
  const line = redact(text.replace(/\s+/g, ' ').trim());
  return line.length > MAX_DETAIL ? `${line.slice(0, MAX_DETAIL - 3)}...` : line;
}

/** Run a command in the user's shell with a timeout. Kills the whole process group on timeout. */
function runShell(cmd, timeoutMs) {
  return new Promise((done) => {
    let output = '';
    let timedOut = false;
    let settled = false;
    let grace;
    const child = spawn(SHELL[0], [SHELL[1], cmd], { stdio: ['ignore', 'pipe', 'pipe'], detached: true });
    const collect = (chunk) => {
      if (output.length < MAX_CAPTURE) output += chunk;
    };
    child.stdout.setEncoding('utf8').on('data', collect);
    child.stderr.setEncoding('utf8').on('data', collect);
    const finish = (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(grace);
      done({ output, code, timedOut });
    };
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        child.kill('SIGKILL');
      }
      // If a stray process still holds the pipes, stop waiting for them.
      grace = setTimeout(() => {
        child.stdout.destroy();
        child.stderr.destroy();
        finish(null);
      }, 1000);
    }, timeoutMs);
    child.on('error', (e) => {
      output += e.message;
      finish(null);
    });
    child.on('close', (code) => finish(code));
  });
}

async function commandCheck({ cmd, expect }, timeoutMs) {
  // The command comes from the profile; redact it too in case it carries a credential.
  const name = redact(expect ? `${cmd} => ${expect}` : cmd);
  if (!cmd) return { kind: 'command', name, status: 'FAIL', detail: 'empty command in profile' };
  const { output, code, timedOut } = await runShell(cmd, timeoutMs);
  if (timedOut) return { kind: 'command', name, status: 'FAIL', detail: `timed out after ${timeoutMs / 1000} s` };
  const pass = expect ? output.includes(expect) : code === 0;
  let detail;
  if (pass) {
    const hit = expect ? output.split('\n').find((l) => l.includes(expect)) : output.split('\n').find((l) => l.trim());
    detail = detailOf(hit || '');
  } else {
    const shown = detailOf(output);
    detail = shown ? `exit ${code}: ${shown}` : `exit ${code}, no output`;
  }
  return { kind: 'command', name, status: pass ? 'PASS' : 'FAIL', detail };
}

function repoCheck(name, path) {
  const label = `repo ${name}`;
  if (!existsSync(path)) return { kind: 'repo', name: label, path, status: 'FAIL', detail: 'path not found' };
  const r = spawnSync('git', ['-C', path, 'rev-parse', '--git-dir'], { encoding: 'utf8' });
  return r.status === 0
    ? { kind: 'repo', name: label, path, status: 'PASS', detail: 'git repo' }
    : { kind: 'repo', name: label, path, status: 'FAIL', detail: 'not a git repo' };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  const seconds = args.timeout === undefined ? 20 : Number(args.timeout);
  if (!(seconds > 0)) {
    process.stderr.write(`preflight: --timeout must be a positive number of seconds\n${USAGE}\n`);
    return 2;
  }
  const profile = profileFor(process.cwd(), typeof args.profile === 'string' ? args.profile : undefined);
  if (!profile) {
    process.stderr.write(
      args.profile
        ? `preflight: profile not found: ${args.profile}\n`
        : 'preflight: no spec-profile.md found from this folder upwards; pass --profile <path>\n',
    );
    return 1;
  }

  const checks = [];
  for (const entry of profile.preflight) checks.push(await commandCheck(entry, seconds * 1000));
  for (const [name, path] of Object.entries(profile.repos)) checks.push(repoCheck(name, path));
  const failed = checks.filter((c) => c.status === 'FAIL').length;

  if (args.json) {
    process.stdout.write(`${JSON.stringify({ profile: profile.path, ok: failed === 0, checks }, null, 2)}\n`);
  } else {
    const lines = [`preflight: ${profile.path}`];
    if (!profile.preflight.length) lines.push('note: the profile has no preflight entries');
    for (const c of checks) lines.push(`${c.status}  ${c.name}${c.path ? ` (${c.path})` : ''}${c.detail ? `  | ${c.detail}` : ''}`);
    lines.push(failed ? `${failed} of ${checks.length} checks failed.` : `All ${checks.length} checks passed.`);
    process.stdout.write(`${lines.join('\n')}\n`);
  }
  return failed ? 1 : 0;
}

process.exitCode = await main();
