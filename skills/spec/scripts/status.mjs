#!/usr/bin/env node
// Show where one spec, or every spec under spec_home, stands: tier, status, files, lint, tokens, progress per repo.
// See ../references/conventions.md sections 2 (files per tier and budgets) and 8 (progress files).
//
// usage: node status.mjs [<spec-dir> | --all] [--profile path] [--json]
// Without arguments: the current folder if it is a spec folder, otherwise --all.
// Tokens count as budgets do (chars / 4, HTML comments left out). Required reading is intent.md plus each
// pr-<repo>.md (spec.md for tier S), before the Read first sections. Task rows live in progress-<repo>.json.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { budgetTokens, parseArgs, parseFrontMatter, profileFor, profileForSpec, readJson, TIER_FILES } from './lib/spec.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const LINT = join(HERE, 'spec-lint.mjs');
const USAGE = 'usage: status.mjs [<spec-dir> | --all] [--profile path] [--json]';
const TASK_STATES = ['done', 'in_progress', 'todo', 'blocked'];

const isSpecDir = (dir) => existsSync(join(dir, 'intent.md')) || existsSync(join(dir, 'spec.md'));
const filled = (v) => typeof v === 'string' ? v.trim() !== '' : v !== undefined && v !== null;

function listSpecs(home) {
  if (!existsSync(home)) return [];
  return readdirSync(home, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.') && d.name !== 'archive')
    .map((d) => join(home, d.name))
    .filter(isSpecDir)
    .sort();
}

/** Count errors and warnings in spec-lint --json output, whatever its exact shape. */
function countFindings(j) {
  const count = (v) => (Array.isArray(v) ? v.length : typeof v === 'number' ? v : null);
  const src = j && typeof j === 'object' && j.summary && typeof j.summary === 'object' ? j.summary : j;
  let errors = count(src?.errors);
  let warnings = count(src?.warnings);
  const list = [j?.findings, j?.issues, j?.results, Array.isArray(j) ? j : null].find(Array.isArray);
  if ((errors === null || warnings === null) && list) {
    const sev = (f) => String(f?.severity ?? f?.level ?? f?.type ?? '').toLowerCase();
    if (errors === null) errors = list.filter((f) => sev(f) === 'error').length;
    if (warnings === null) warnings = list.filter((f) => sev(f).startsWith('warn')).length;
  }
  return { errors, warnings };
}

function lint(dir, profilePath) {
  if (!existsSync(LINT)) return { available: false };
  const args = [LINT, dir, '--json', ...(profilePath ? ['--profile', profilePath] : [])];
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 60000, maxBuffer: 16 << 20 });
  let parsed;
  try {
    parsed = JSON.parse(r.stdout);
  } catch {
    return { available: true, exit: r.status, errors: null, warnings: null };
  }
  return { available: true, exit: r.status, ...countFindings(parsed) };
}

function progressOf(dir, file) {
  const j = readJson(join(dir, file));
  const repo = file.slice('progress-'.length, -'.json'.length);
  if (!j) return { file, repo, error: 'not valid JSON' };
  const tasks = Array.isArray(j.tasks) ? j.tasks : [];
  const counts = Object.fromEntries(TASK_STATES.map((s) => [s, 0]));
  for (const t of tasks) {
    const s = filled(t?.status) ? t.status : 'todo';
    counts[s] = (counts[s] || 0) + 1;
  }
  // The template ships an empty example deviation; only entries with content count.
  const deviations = (Array.isArray(j.deviations) ? j.deviations : []).filter(
    (d) => d && ['task', 'from', 'proposal'].some((k) => filled(d[k])),
  );
  const open = deviations.filter((d) => !filled(d.decidedBy));
  return {
    file,
    repo: filled(j.repo) ? j.repo : repo,
    tasks: tasks.length,
    counts,
    deviations: deviations.length,
    openDeviations: open.length,
    open: open.map((d) => ({ task: d.task || '', from: d.from || '' })),
  };
}

function inspect(dir, profilePath) {
  const files = readdirSync(dir).filter((f) => statSync(join(dir, f)).isFile());
  const head = ['intent.md', 'spec.md'].find((f) => files.includes(f));
  const fm = head ? parseFrontMatter(readFileSync(join(dir, head), 'utf8')).data : {};
  const tier = (fm.tier || '').toUpperCase();
  const prRepos = files.filter((f) => /^pr-.+\.md$/.test(f)).map((f) => f.slice(3, -3));
  const progressFiles = files.filter((f) => /^progress-.+\.json$/.test(f)).sort();

  const required = [...(TIER_FILES[tier] || [])];
  if (tier === 'S') {
    if (progressFiles.length) required.push(...progressFiles);
    else required.push('progress-<repo>.json');
  } else if (tier === 'M' || tier === 'L') {
    if (prRepos.length) for (const r of prRepos) required.push(`pr-${r}.md`, `progress-${r}.json`);
    else required.push('pr-<repo>.md', 'progress-<repo>.json');
  }
  const missing = required.filter((f) => !files.includes(f));

  const mdTokens = Object.fromEntries(files.filter((f) => f.endsWith('.md'))
    .map((f) => [f, budgetTokens(readFileSync(join(dir, f), 'utf8'))]));
  const intentTokens = mdTokens['intent.md'] || 0;
  const reading = tier === 'S'
    ? { 'spec.md': mdTokens['spec.md'] || 0 }
    : Object.fromEntries(prRepos.map((r) => [r, intentTokens + (mdTokens[`pr-${r}.md`] || 0)]));
  const tokens = { folder: Object.values(mdTokens).reduce((a, b) => a + b, 0), requiredReading: reading };

  return {
    slug: fm.spec || basename(dir),
    dir,
    tier: tier || '?',
    status: fm.status || '?',
    files: { required: required.length, present: required.length - missing.length, missing },
    tokens,
    lint: lint(dir, profilePath),
    progress: progressFiles.map((f) => progressOf(dir, f)),
  };
}

function lintText(l) {
  if (!l.available) return 'not available';
  if (l.errors === null || l.warnings === null) return `exit ${l.exit} (output not readable)`;
  return `${l.errors} errors, ${l.warnings} warnings`;
}

function progressText(p) {
  if (p.error) return `progress ${p.repo}: ${p.error}`;
  const parts = Object.entries(p.counts).map(([s, n]) => `${n} ${s}`);
  const open = p.open.map((d) => [d.task, d.from].filter(Boolean).join(' vs ')).filter(Boolean);
  return `progress ${p.repo}: ${p.tasks} tasks (${parts.join(', ')}); open deviations: ${p.openDeviations}${open.length ? ` (${open.join('; ')})` : ''}`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }
  const explicit = typeof args.profile === 'string' ? args.profile : undefined;
  let dirs;
  let home = null;
  let homeProfile = null;
  if (args._[0] && !args.all) {
    const dir = resolve(args._[0]);
    if (!existsSync(dir) || !statSync(dir).isDirectory()) {
      process.stderr.write(`status: not a folder: ${dir}\n${USAGE}\n`);
      return 2;
    }
    dirs = [dir];
  } else if (!args.all && isSpecDir(process.cwd())) {
    dirs = [process.cwd()];
  } else {
    const profile = profileFor(process.cwd(), explicit);
    if (!profile) {
      process.stderr.write('status: no spec-profile.md found from this folder upwards; pass --profile <path> or a spec folder\n');
      return 2;
    }
    home = profile.specHome;
    homeProfile = profile.path;
    dirs = listSpecs(home);
  }

  // Lint each spec with the profile found here, so a spec_home outside the project keeps every check.
  const specs = dirs.map((dir) => inspect(dir, homeProfile || profileForSpec(dir, explicit)?.path));

  if (args.json) {
    process.stdout.write(`${JSON.stringify({ home, specs }, null, 2)}\n`);
    return 0;
  }
  if (!specs.length) {
    process.stdout.write(`No spec folders under ${home}.\n`);
    return 0;
  }
  const blocks = specs.map((s) => {
    const lines = [`${s.slug}  tier ${s.tier}  status ${s.status}`, `  folder: ${s.dir}`];
    const f = s.files;
    lines.push(`  files: ${f.present}/${f.required} required present${f.missing.length ? `; missing: ${f.missing.join(', ')}` : ''}`);
    lines.push(`  lint: ${lintText(s.lint)}`);
    const reading = Object.entries(s.tokens.requiredReading).map(([k, v]) => `${k} ${v}`).join(', ');
    lines.push(`  tokens: folder ${s.tokens.folder}; required reading: ${reading || 'no briefs yet'}`);
    if (!s.progress.length) lines.push('  progress: none');
    for (const p of s.progress) lines.push(`  ${progressText(p)}`);
    return lines.join('\n');
  });
  process.stdout.write(`${blocks.join('\n\n')}\n`);
  return 0;
}

process.exitCode = main();
