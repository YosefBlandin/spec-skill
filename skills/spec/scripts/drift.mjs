#!/usr/bin/env node
// Check every `repo:path#Symbol` reference in a spec folder against the pinned refs and origin/<base_branch>.
// See ../references/conventions.md sections 3 (refs) and 5 (code references).
//
// usage: node drift.mjs <spec-dir> [--profile path] [--json] [--strict]
// Status per reference:
//   OK               file and symbol exist at the pin and at the base, and the file is unchanged
//   MISSING_AT_PIN   file or symbol not found at the pinned sha   (exits 1)
//   MISSING_AT_BASE  present at the pin, but the file or symbol is gone at the base
//   FILE_CHANGED     present in both, but the file differs between the pin and the base
//   UNCHECKED        no repo path, no pin, or the pin is not in the local repo   (exits 1 with --strict)
//   NEW              cited with "(new)" somewhere in the folder: a task creates it, so it is not checked
// References count anywhere in the top-level .md files (prose, tables, backticks, code fences), except in HTML comments.
// The base is origin/<base_branch>, or the local <base_branch> when there is no remote-tracking branch; if neither
// exists, only the pin is checked. It never fetches: run `git -C <repo> fetch origin <base_branch>` first.

import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs, parseFrontMatter, profileForSpec, specFiles, splitList } from './lib/spec.mjs';

const USAGE = 'usage: drift.mjs <spec-dir> [--profile path] [--json] [--strict]';
const SHA = /^[0-9a-f]{4,40}$/i;
const ORDER = ['MISSING_AT_PIN', 'MISSING_AT_BASE', 'FILE_CHANGED', 'UNCHECKED', 'NEW', 'OK'];
const NEW_MARK = /^[`*_]*\s*\(new\)/; // after the ref, past any closing backtick or emphasis

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function usageError(msg) {
  process.stderr.write(`drift: ${msg}\n${USAGE}\n`);
  process.exit(2);
}

/** Pins from the `refs:` front-matter line of intent.md or spec.md: { name: sha }. */
function readPins(specDir) {
  for (const f of ['intent.md', 'spec.md']) {
    const p = join(specDir, f);
    if (!existsSync(p)) continue;
    const { data } = parseFrontMatter(readFileSync(p, 'utf8'));
    if (data.refs === undefined) continue;
    const pins = {};
    for (const item of splitList(data.refs, /\s*,\s*/)) {
      const at = item.indexOf('@');
      if (at > 0) pins[item.slice(0, at).trim()] = item.slice(at + 1).trim();
    }
    return { file: f, slug: data.spec, pins };
  }
  return { file: null, slug: null, pins: {} };
}

/** Blank out HTML comments (template guidance), keeping line numbers. Code fences and backticks stay. */
function stripComments(text) {
  return text.replace(/<!--[\s\S]*?(?:-->|$)/g, (c) => c.replace(/[^\n]/g, ' '));
}

/**
 * All `repo:path#Symbol` references, deduplicated, with the file:line places that cite them. A reference followed by
 * "(new)" anywhere in the folder is marked isNew: a task creates it.
 */
function collectRefs(specDir, repoNames) {
  if (!repoNames.length) return [];
  const names = repoNames.map(escapeRe).join('|');
  const re = new RegExp(
    `(?<![\\w./-])(${names}):(?!/)([^\\s\`'"()<>\\[\\]{}#,;|]+)#([A-Za-z_$][\\w$]*(?:\\.[A-Za-z_$][\\w$]*)*)`,
    'g',
  );
  const byKey = new Map();
  for (const file of specFiles(specDir)) {
    const lines = stripComments(readFileSync(join(specDir, file), 'utf8')).split('\n');
    lines.forEach((line, i) => {
      for (const m of line.matchAll(re)) {
        const [, repo, rawPath, symbol] = m;
        const path = rawPath.replace(/^\.\//, '');
        const key = `${repo}:${path}#${symbol}`;
        if (!byKey.has(key)) byKey.set(key, { ref: key, repo, path, symbol, isNew: false, cited: [] });
        const entry = byKey.get(key);
        entry.cited.push(`${file}:${i + 1}`);
        if (NEW_MARK.test(line.slice(m.index + m[0].length))) entry.isNew = true;
      }
    });
  }
  return [...byKey.values()];
}

/** Word match; a dotted symbol (Class.method) needs every part. */
const hasSymbol = (text, symbol) =>
  symbol.split('.').every((part) => new RegExp(`(?<![\\w$])${escapeRe(part)}(?![\\w$])`).test(text));

function makeGit() {
  const cache = new Map();
  const run = (repo, args) =>
    spawnSync('git', ['-C', repo, ...args], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const memo = (key, fn) => {
    if (!cache.has(key)) cache.set(key, fn());
    return cache.get(key);
  };
  return {
    revExists: (repo, rev) =>
      memo(`rev\0${repo}\0${rev}`, () => run(repo, ['rev-parse', '--verify', '--quiet', `${rev}^{commit}`]).status === 0),
    fileAt: (repo, rev, path) =>
      memo(`show\0${repo}\0${rev}\0${path}`, () => {
        const r = run(repo, ['show', `${rev}:${path}`]);
        // `git show` on a folder prints a tree listing; only a file counts.
        if (r.status !== 0 || r.stdout.startsWith(`tree ${rev}:`)) return null;
        return r.stdout;
      }),
    changed: (repo, a, b, path) => run(repo, ['diff', '--quiet', a, b, '--', path]).status !== 0,
  };
}

function checkRef(ref, ctx) {
  const { profile, pins, git } = ctx;
  if (ref.isNew) return { status: 'NEW', detail: 'a task creates it; not checked' };
  const repoPath = profile.repos[ref.repo];
  if (!repoPath) return { status: 'UNCHECKED', detail: `repo ${ref.repo} is not in the profile` };
  if (!existsSync(repoPath)) return { status: 'UNCHECKED', detail: `repo path not found: ${repoPath}` };
  const pin = pins[ref.repo];
  if (!pin || !SHA.test(pin)) return { status: 'UNCHECKED', detail: `no sha pinned for ${ref.repo} in refs` };
  if (!git.revExists(repoPath, pin)) return { status: 'UNCHECKED', detail: `pin ${pin} is not in the local repo` };

  const atPin = git.fileAt(repoPath, pin, ref.path);
  if (atPin === null) return { status: 'MISSING_AT_PIN', detail: `file not found at ${pin}` };
  if (!hasSymbol(atPin, ref.symbol)) return { status: 'MISSING_AT_PIN', detail: `symbol not found at ${pin}` };

  const branch = profile.baseBranch[ref.repo];
  if (!branch) return { status: 'OK', detail: 'no base_branch in the profile; pin only' };
  // Prefer the remote-tracking branch; fall back to a local branch (repos without a remote).
  const base = git.revExists(repoPath, `origin/${branch}`) ? `origin/${branch}` : branch;
  if (!git.revExists(repoPath, base)) return { status: 'OK', detail: `neither origin/${branch} nor ${branch} found locally; pin only` };
  const atBase = git.fileAt(repoPath, base, ref.path);
  if (atBase === null) return { status: 'MISSING_AT_BASE', detail: `file not found at ${base}` };
  if (!hasSymbol(atBase, ref.symbol)) return { status: 'MISSING_AT_BASE', detail: `symbol not found at ${base}` };
  if (git.changed(repoPath, pin, base, ref.path)) return { status: 'FILE_CHANGED', detail: `file differs between ${pin} and ${base}` };
  return { status: 'OK', detail: '' };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  // Boolean flags never take a value: `--strict <dir>` means the flag, then the folder.
  for (const flag of ['json', 'strict', 'help']) {
    if (typeof args[flag] === 'string') { args._.unshift(args[flag]); args[flag] = true; }
  }
  if (args.help || args.h) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  if (!args._[0]) usageError('missing <spec-dir>');
  const specDir = resolve(args._[0]);
  if (!existsSync(specDir) || !statSync(specDir).isDirectory()) usageError(`not a folder: ${specDir}`);
  const explicit = typeof args.profile === 'string' ? args.profile : undefined;
  const profile = profileForSpec(specDir, explicit);
  if (!profile) {
    process.stderr.write(`drift: no spec-profile.md found for ${specDir}; pass --profile <path>\n`);
    return 2;
  }

  const { file: pinFile, slug, pins } = readPins(specDir);
  const repoNames = [...new Set([...Object.keys(profile.repos), ...Object.keys(pins)])];
  const refs = collectRefs(specDir, repoNames);
  const git = makeGit();
  const results = refs
    .map((ref) => ({ ...ref, ...checkRef(ref, { profile, pins, git }) }))
    .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status) || a.ref.localeCompare(b.ref));
  const summary = Object.fromEntries(ORDER.map((s) => [s, results.filter((r) => r.status === s).length]));
  const strict = Boolean(args.strict);
  const ok = summary.MISSING_AT_PIN === 0 && (!strict || summary.UNCHECKED === 0);

  if (args.json) {
    const out = { spec: slug || basename(specDir), dir: specDir, pinsFrom: pinFile, pins, strict, ok, summary, results };
    process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
    return ok ? 0 : 1;
  }

  const pinText = Object.entries(pins).map(([n, s]) => `${n}@${s}`).join(', ');
  const lines = [`drift: ${slug || basename(specDir)} (pins: ${pinText || 'none; add refs to intent.md or spec.md'})`];
  if (!results.length) lines.push('No repo:path#Symbol references found.');
  const width = Math.max(0, ...results.map((r) => r.status.length));
  for (const r of results) {
    lines.push(`${r.status.padEnd(width)}  ${r.ref}${r.detail ? `  (${r.detail})` : ''}  [${r.cited.join(', ')}]`);
  }
  if (results.length) {
    const parts = ORDER.filter((s) => summary[s]).map((s) => `${summary[s]} ${s}`);
    lines.push(`${results.length} references: ${parts.join(', ')}.`);
  }
  if (summary.UNCHECKED) {
    lines.push(strict
      ? `Error: ${summary.UNCHECKED} references could not be checked (--strict).`
      : `Warning: ${summary.UNCHECKED} references could not be checked.`);
  }
  process.stdout.write(`${lines.join('\n')}\n`);
  return ok ? 0 : 1;
}

process.exitCode = main();
