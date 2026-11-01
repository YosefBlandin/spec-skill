#!/usr/bin/env node
// spec-lint: deterministic checks for one spec folder. It enforces the [lint] rules in ../references/conventions.md.
//
// usage: node spec-lint.mjs <spec-dir> [--profile path] [--json] [--impact <ID>]
// Exit 1 when there are errors, 0 otherwise (warnings never fail), 2 on a usage error.
// Profile: --profile, else the first one walking up from the spec folder, else walking up from the current folder.
// It never prints a matched forbidden string: only file:line and the line number in the strings file.

import { readFileSync, existsSync, statSync, readdirSync, realpathSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseFrontMatter, profileForSpec, specFiles, budgetTokens, budgetFor, splitList,
  TIER_FILES, FAMILIES, taskFamily, isHome, parseArgs,
} from './lib/spec.mjs';

const USAGE = 'usage: spec-lint.mjs <spec-dir> [--profile path] [--json] [--impact <ID>]';
const GATES = ['G-intake', 'G-research', 'G-design', 'G-handoff', 'G-merge', 'G-promote', 'G-close'];
const STATUS_RE = /^(draft|locked-v\d+|executing|closed)$/;
const LOCKED_RE = /^(locked-v\d+|executing|closed)$/;
const READING_BUDGET = 15000;
const CARD_FIELDS = ['Blocks', 'Default', 'Door', 'Owner', 'Answer-by'];
const PRIMARY_ONLY_KEYS = ['refs', 'door', 'appetite'];

// Any id-like token: PREFIX(-SEGMENT)*-n, for example AC-3, T-POL-4, AL-WEB-15, DEMO-12.
const ID_BODY = '[A-Z][A-Z0-9]*(?:-[A-Z][A-Z0-9]*)*-\\d+';
const LEFT = '(?<![A-Za-z0-9_-])';
const RIGHT = '(?![A-Za-z0-9_]|-[A-Za-z0-9])';
const SUFFIX_RE = new RegExp(`${LEFT}(${ID_BODY})([a-z])(?![A-Za-z0-9_])`, 'g');
const RANGE_RE = new RegExp(
  `${LEFT}(${ID_BODY})(?:(?:\\.\\.\\.?|…)\\s*(\\d+)|[–—](\\d+)|\\/(\\d+)|\\s*(?:\\.\\.\\.?|…|[–—])\\s*(${ID_BODY}))(?![A-Za-z0-9_])`,
  'g',
);
const HEADING_ID_RE = new RegExp(`^(${ID_BODY})${RIGHT}`);
const ID_ONLY_RE = new RegExp(`^${ID_BODY}$`);
const GATE_NUMBER_RE = new RegExp(`${LEFT}G-\\d+(?![A-Za-z0-9_])`, 'g');
const MARKER_RE = /\[NEEDS CLARIFICATION(?:\s*:\s*([^\]]*))?\]/g;
const HUMAN_RE = /<HUMAN\b/g;
const TODO_RE = /\b(TODO|TBD|FIXME)\b/g;

const prefixOf = (id) => id.replace(/-\d+$/, '');
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const humanAllowed = (f) => f === 'release.md' || f === 'spec.md' || /^pr-.+\.md$/.test(f);
const unfilled = (v) => v === undefined || v === '' || v === 'none' || /<[^>]*>/.test(v);

/** Split text into lines and mask front matter, fenced code blocks and HTML comments with blanks. */
export function maskLines(lines, frontMatterEnd = 0) {
  const out = [];
  let fence = null;
  let inComment = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i < frontMatterEnd) { out.push(''); continue; }
    if (fence) {
      const m = line.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
      if (m && m[1][0] === fence.ch && m[1].length >= fence.len) fence = null;
      out.push('');
      continue;
    }
    if (!inComment) {
      const m = line.match(/^ {0,3}(`{3,}|~{3,})/);
      if (m) { fence = { ch: m[1][0], len: m[1].length }; out.push(''); continue; }
    }
    let res = '';
    let pos = 0;
    while (pos < line.length) {
      if (inComment) {
        const end = line.indexOf('-->', pos);
        const stop = end === -1 ? line.length : end + 3;
        res += ' '.repeat(stop - pos);
        pos = stop;
        if (end !== -1) inComment = false;
      } else {
        const start = line.indexOf('<!--', pos);
        if (start === -1) { res += line.slice(pos); pos = line.length; }
        else { res += line.slice(pos, start) + '    '; pos = start + 4; inComment = true; }
      }
    }
    out.push(res);
  }
  return out;
}

/** Read one markdown file: raw lines, masked lines and front matter (with key line numbers). */
function loadDoc(dir, file) {
  const raw = readFileSync(join(dir, file), 'utf8');
  const lines = raw.split(/\r?\n/);
  const { data, endLine } = parseFrontMatter(raw.replace(/\r\n/g, '\n'));
  const keyLine = {};
  const badLines = [];
  for (let i = 1; i < endLine - 1; i++) {
    const t = lines[i].trim();
    if (!t || t.startsWith('#')) continue;
    const m = lines[i].match(/^([A-Za-z0-9_.-]+):/);
    if (m) keyLine[m[1]] = i + 1;
    else badLines.push(i + 1);
  }
  return {
    file, raw, lines, tokens: budgetTokens(raw),
    fm: endLine ? { data, endLine, keyLine, badLines } : null,
    masked: maskLines(lines, endLine),
  };
}

/** Family table for a tier; an unknown tier allows the union of all homes. */
function familiesFor(tier, prefixes) {
  const all = { ...FAMILIES, TASK: taskFamily(prefixes) };
  return Object.entries(all).map(([name, f]) => ({
    name,
    re: f.re,
    exact: new RegExp(`^(?:${f.re})$`),
    homes: f.home[tier] || [...new Set(Object.values(f.home).flat())],
  }));
}

/** Task prefixes: the profile's task_prefix entries, else its repo names, else pr-/progress- file names. */
function taskPrefixes(profile, dir) {
  const clean = (s) => s.toUpperCase().replace(/[^A-Z0-9-]/g, '');
  if (profile) {
    const p = Object.values(profile.taskPrefix).map(clean).filter(Boolean);
    if (p.length) return [...new Set(p)];
    const r = Object.keys(profile.repos).map(clean).filter(Boolean);
    if (r.length) return [...new Set(r)];
  }
  const names = readdirSync(dir)
    .map((f) => f.match(/^pr-(.+)\.md$/) || f.match(/^progress-(.+)\.json$/))
    .filter(Boolean)
    .map((m) => clean(m[1]))
    .filter(Boolean);
  return [...new Set(names)];
}

/** Definition position on a line: first table cell or heading start. Returns { token, index, kind, rest, retired }. */
function definitionSlot(line) {
  if (/^\s*\|/.test(line)) {
    const cells = line.split('|');
    const first = cells[1] ?? '';
    const inner = first.trim().replace(/^(\*\*|`)/, '').replace(/(\*\*|`)$/, '');
    if (!inner) return null;
    const after = cells.slice(2);
    if (after.length && after[after.length - 1].trim() === '') after.pop();
    const startsRetired = (c) => /^[\s*~_]*RETIRED\b/.test(c || '');
    const retired = startsRetired(after[0]) || startsRetired(after[after.length - 1]);
    return { token: inner, index: line.indexOf(inner, line.indexOf('|') + 1), kind: 'row', retired };
  }
  const h = line.match(/^(#{1,6}\s+(?:\*\*)?)(.*)$/);
  const m = h && h[2].match(HEADING_ID_RE);
  if (!m) return null;
  const rest = h[2].slice(m[1].length);
  const retired = /^[\s·:|*~—–-]*RETIRED\b/.test(rest);
  return { token: m[1], index: h[1].length, kind: 'heading', rest, retired };
}

/** Collect every family id occurrence in the folder: definitions (in home files) and references. */
function collectIds(docs, fams) {
  const combined = new RegExp(`${LEFT}(${fams.map((f) => `(?:${f.re})`).join('|')})${RIGHT}`, 'g');
  const familyOf = (id) => fams.find((f) => f.exact.test(id));
  const occ = [];
  for (const d of docs) {
    d.masked.forEach((line, i) => {
      const slot = definitionSlot(line);
      const markers = [...line.matchAll(MARKER_RE)].map((m) => [m.index, m.index + m[0].length]);
      for (const m of line.matchAll(combined)) {
        const id = m[1];
        const fam = familyOf(id);
        if (!fam) continue;
        const atSlot = slot && slot.index === m.index && slot.token === id;
        const isDef = atSlot && isHome(d.file, fam.homes) && !(slot.kind === 'heading' && /^\s*options\b/i.test(slot.rest));
        occ.push({
          id, family: fam.name, homes: fam.homes, file: d.file, line: i + 1,
          kind: isDef ? 'def' : 'ref',
          defType: isDef ? slot.kind : null,
          retired: isDef ? slot.retired : false,
          inMarker: markers.some(([a, b]) => m.index >= a && m.index < b),
        });
      }
    });
  }
  return occ;
}

/** Owner of each line for --impact: the id in the row's first cell, else the id that starts the last heading. */
function owners(masked) {
  const out = [];
  let heading = null;
  for (const line of masked) {
    const slot = definitionSlot(line);
    if (/^#{1,6}\s/.test(line)) heading = slot && slot.kind === 'heading' ? slot.token : null;
    out.push({ row: slot && slot.kind === 'row' && ID_ONLY_RE.test(slot.token) ? slot.token : null, heading });
  }
  return out;
}

function checkQuestionCard(d, idx, id, report) {
  const lines = d.masked;
  if (!new RegExp(`^###\\s+${id}\\s+·\\s+\\S`).test(lines[idx])) {
    report.error(d.file, idx + 1, 'question-card', `${id}: the heading must read "### ${id} · <short plain title>"`);
  }
  let j = idx + 1;
  while (j < lines.length && !lines[j].trim()) j++;
  const isHeading = (l) => /^#{1,6}\s/.test(l);
  const fieldLine = j < lines.length && !isHeading(lines[j]) ? lines[j] : '';
  const fields = {};
  for (const part of fieldLine.split('·')) {
    const m = part.match(/^\s*([A-Za-z-]+)\s*:\s*(.*?)\s*$/);
    if (m) fields[m[1].toLowerCase()] = m[2];
  }
  const at = fieldLine ? j + 1 : idx + 1;
  const missing = CARD_FIELDS.filter((k) => !(k.toLowerCase() in fields));
  if (missing.length) {
    report.error(d.file, at, 'question-card',
      `${id}: the line after the heading must have ${CARD_FIELDS.join(' · ')}; missing ${missing.join(', ')}`);
  }
  const blocks = fields.blocks;
  const def = fields.default;
  if (blocks !== undefined) {
    const gates = blocks === 'none' ? [] : splitList(blocks);
    if (blocks !== 'none' && (!gates.length || gates.some((g) => !GATES.includes(g)))) {
      report.error(d.file, at, 'question-card', `${id}: Blocks must be a gate (${GATES.join(', ')}) or none`);
    }
  }
  if (def !== undefined && !/^[A-Z]$/.test(def) && !/^NONE\b/.test(def)) {
    report.error(d.file, at, 'question-card', `${id}: Default must be an option letter or NONE`);
  }
  if (fields.door !== undefined && !/^[12]-way$/.test(fields.door)) {
    report.error(d.file, at, 'question-card', `${id}: Door must be 1-way or 2-way`);
  }
  if (fields.owner !== undefined && !fields.owner) report.error(d.file, at, 'question-card', `${id}: Owner is empty`);
  if (fields['answer-by'] !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(fields['answer-by'])) {
    report.error(d.file, at, 'question-card', `${id}: Answer-by must be a date (YYYY-MM-DD)`);
  }
  if (def && /^NONE\b/.test(def) && blocks === 'none') {
    report.error(d.file, at, 'question-card', `${id}: Default NONE needs a gate in Blocks (it cannot be none)`);
  }
  // Card body: until the next heading.
  let end = idx + 1;
  while (end < lines.length && !isHeading(lines[end])) end++;
  const body = [];
  for (let k = idx + 1; k < end; k++) if (k !== j || !fieldLine) body.push([k, lines[k]]);
  if (def && /^[A-Z]$/.test(def) && !body.some(([, l]) => new RegExp(`^\\s*${def}\\.\\s`).test(l))) {
    report.error(d.file, at, 'question-card', `${id}: Default ${def} has no option line "${def}. …"`);
  }
  for (const [k, l] of body) {
    const m = l.match(/^\s*(Context:|[A-Z]\.)\s+(.*)$/);
    if (!m) continue;
    if (l.includes('`')) report.warn(d.file, k + 1, 'plain-language', `${id}: no code spans in Context or option lines`);
    for (const s of m[2].split(/(?<=[.!?])\s+/)) {
      const words = s.split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w)).length;
      if (words > 25) report.warn(d.file, k + 1, 'plain-language', `${id}: a sentence has ${words} words; keep it to 25 or fewer`);
    }
  }
}

/** Forbidden strings from the profile's file: [{ n: line number, s: lower-case text }], or null if none is named. */
function forbiddenNeedles(profile) {
  const src = profile?.forbiddenStringsFile;
  if (!src) return null;
  if (!existsSync(src)) return { missing: true, list: [] };
  const list = readFileSync(src, 'utf8').split(/\r?\n/)
    .map((l, i) => ({ n: i + 1, s: l.trim().toLowerCase() }))
    .filter((x) => x.s && !x.s.startsWith('#'));
  return { missing: false, list };
}

/** Replace any forbidden string in output text, so no message or path ever prints one. */
function redactor(needles) {
  if (!needles?.list.length) return (s) => s;
  const re = new RegExp(needles.list.map((x) => escapeRe(x.s)).join('|'), 'gi');
  return (s) => (typeof s === 'string' ? s.replace(re, '[forbidden string]') : s);
}

/** Report file:line and the strings-file line number only. Scans every .md and .json file, archive/ included. */
function forbiddenCheck(dir, needles, report) {
  if (!needles) return;
  if (needles.missing) {
    report.warn('', 0, 'forbidden-string', 'the profile names a forbidden_strings_file that does not exist; check skipped');
    return;
  }
  if (!needles.list.length) return;
  const walk = (rel) => {
    for (const e of readdirSync(join(dir, rel), { withFileTypes: true })) {
      const p = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) { if (!e.name.startsWith('.') && e.name !== 'node_modules') walk(p); continue; }
      if (!/\.(md|json)$/.test(e.name)) continue;
      readFileSync(join(dir, p), 'utf8').split(/\r?\n/).forEach((line, i) => {
        const low = line.toLowerCase();
        for (const x of needles.list) {
          if (low.includes(x.s)) report.error(p, i + 1, 'forbidden-string', `matches line ${x.n} of the forbidden-strings file`);
        }
      });
    }
  };
  walk('');
}

/**
 * Coverage, once the first test row exists (or the folder is locked): every AC is traced by a test row or named in an
 * "Accepted, no test" row, and every test row's task cell is a task id or manual. Warnings while draft, errors once locked.
 */
function coverageCheck(docs, defs, fams, locked, report) {
  const tests = [...defs.values()].filter((o) => o.family === 'T' && o.defType === 'row');
  if (!tests.length && !locked) return;
  const soft = locked ? report.error : report.warn;
  const acRe = new RegExp(`${LEFT}AC-\\d+${RIGHT}`, 'g');
  const taskRe = fams.find((f) => f.name === 'TASK').exact;
  const traced = new Set();
  for (const o of tests) {
    const cells = docs.find((d) => d.file === o.file).masked[o.line - 1].split('|').map((c) => c.trim());
    for (const m of (cells[2] || '').matchAll(acRe)) traced.add(m[0]);
    const tasks = splitList((cells[3] || '').replace(/[`*]/g, ''), /\s*,\s*/);
    if (!tasks.length || tasks.some((t) => t !== 'manual' && !taskRe.test(t))) {
      soft(o.file, o.line, 'coverage', `${o.id}: the task cell must name a task id or manual`);
    }
  }
  for (const d of docs) {
    let accepted = false;
    for (const line of d.masked) {
      if (/^#{1,6}\s/.test(line)) accepted = /accepted,?\s+no test/i.test(line);
      else if (accepted && /^\s*\|/.test(line)) for (const m of line.matchAll(acRe)) traced.add(m[0]);
    }
  }
  for (const o of defs.values()) {
    if (o.family === 'AC' && !o.retired && !traced.has(o.id)) {
      soft(o.file, o.line, 'coverage', `${o.id} has no test row that traces it and no "Accepted, no test" row`);
    }
  }
}

/** Most common value, preferring the primary file's value when it is valid. */
function referenceValue(docs, key, primary, valid) {
  const p = docs.find((d) => d.file === primary);
  const pv = p?.fm?.data[key];
  if (pv && valid(pv)) return pv;
  const counts = new Map();
  for (const d of docs) {
    const v = d.fm?.data[key];
    if (v && valid(v)) counts.set(v, (counts.get(v) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/**
 * Lint a spec folder. opts.profile: a path, undefined (walk up from the folder) or false (no profile).
 * Returns { dir, profile, tier, status, errors, warnings, summary }.
 */
export function lint(specDir, opts = {}) {
  const dir = resolve(specDir);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) throw new Error(`not a folder: ${specDir}`);
  const profile = opts.profile === false ? null : profileForSpec(dir, opts.profile || undefined);
  const errors = [];
  const warnings = [];
  const seen = new Set();
  const add = (list, sev) => (file, line, rule, message) => {
    const key = `${sev}|${file}|${line}|${rule}|${message}`;
    if (seen.has(key)) return;
    seen.add(key);
    list.push({ file, line, rule, message });
  };
  const report = { error: add(errors, 'e'), warn: add(warnings, 'w') };
  if (!profile && opts.profile !== false) {
    report.warn('', 0, 'profile', 'no spec-profile.md found from the spec folder or the current folder; '
      + 'the forbidden-strings, refs and task-prefix checks were skipped (pass --profile <path>)');
  }

  const files = specFiles(dir);
  const docs = files.map((f) => loadDoc(dir, f));
  const others = readdirSync(dir);
  const primary = files.includes('intent.md') ? 'intent.md' : files.includes('spec.md') ? 'spec.md' : null;

  // Front matter: present, flat, with spec/tier/status; one tier, one status and one spec across files.
  const tierOk = (v) => v in TIER_FILES;
  const tier = referenceValue(docs, 'tier', primary, tierOk);
  const status = referenceValue(docs, 'status', primary, (v) => STATUS_RE.test(v));
  const spec = referenceValue(docs, 'spec', primary, Boolean);
  for (const d of docs) {
    if (!d.fm) { report.error(d.file, 1, 'front-matter', 'missing front matter (a --- block with spec, tier and status)'); continue; }
    const { data, keyLine, badLines } = d.fm;
    for (const l of badLines) report.error(d.file, l, 'front-matter', 'front matter must be flat "key: value" lines (no lists or nesting)');
    for (const k of ['spec', 'tier', 'status']) if (!data[k]) report.error(d.file, keyLine[k] || 1, 'front-matter', `front matter lacks ${k}`);
    if (data.tier && !tierOk(data.tier)) report.error(d.file, keyLine.tier, 'front-matter', `tier "${data.tier}" is not S, M or L`);
    else if (data.tier && tier && data.tier !== tier) report.error(d.file, keyLine.tier, 'front-matter', `tier is ${data.tier} here but ${tier} in the folder; use one tier`);
    if (data.status && !STATUS_RE.test(data.status)) {
      report.error(d.file, keyLine.status, 'front-matter', `status "${data.status}" is not draft, locked-vN, executing or closed`);
    } else if (data.status && status && data.status !== status) {
      report.error(d.file, keyLine.status, 'status', `status is ${data.status} here but ${status} in the folder; every file needs the same status`);
    }
    if (data.spec && spec && data.spec !== spec) report.error(d.file, keyLine.spec, 'front-matter', `spec is ${data.spec} here but ${spec} in the folder`);
    if (d.file !== 'intent.md' && d.file !== 'spec.md') {
      for (const k of PRIMARY_ONLY_KEYS) if (k in data) report.warn(d.file, keyLine[k], 'front-matter', `${k} belongs only in intent.md (or spec.md)`);
    }
  }
  const locked = status ? LOCKED_RE.test(status) : false;

  // Required files per tier.
  const prFiles = files.filter((f) => /^pr-.+\.md$/.test(f));
  // The spec's repos: the names pinned in refs (new-spec --repos writes only the repos the spec touches);
  // when refs are not filled in yet, every profile repo.
  const primaryDoc = docs.find((d) => d.file === primary);
  const refsNames = primaryDoc?.fm && !unfilled(primaryDoc.fm.data.refs)
    ? splitList(primaryDoc.fm.data.refs, /\s*,\s*/).map((e) => e.split('@')[0].trim()).filter(Boolean)
    : [];
  const specRepos = refsNames.length ? refsNames : (profile ? Object.keys(profile.repos) : []);
  const progress = others.filter((f) => /^progress-.+\.json$/.test(f));
  if (!tier) {
    report.error('', 0, 'files', 'no valid tier (S, M or L) in any front matter; required files not checked');
  } else {
    for (const f of TIER_FILES[tier]) if (!files.includes(f)) report.error(f, 0, 'files', `missing ${f} (required for tier ${tier})`);
    if (tier === 'S') {
      if (!progress.length) report.warn('progress-<repo>.json', 0, 'files', 'missing progress-<repo>.json');
    } else {
      const repos = specRepos;
      if (repos.length) {
        for (const r of repos) if (!files.includes(`pr-${r}.md`)) report.error(`pr-${r}.md`, 0, 'files', `missing pr-${r}.md (one brief per repo in refs, tier ${tier})`);
        // With refs filled, a brief without a pin is reported once, under refs below.
        if (!refsNames.length) {
          for (const f of prFiles) if (!repos.includes(f.slice(3, -3))) report.warn(f, 0, 'files', `repo "${f.slice(3, -3)}" is not in the profile`);
        }
      } else if (!prFiles.length) {
        report.error('pr-<repo>.md', 0, 'files', `missing pr-<repo>.md (tier ${tier} needs one brief per PR)`);
      }
      for (const f of prFiles) {
        const p = `progress-${f.slice(3, -3)}.json`;
        if (!progress.includes(p)) report.warn(p, 0, 'files', `missing ${p} for ${f}`);
      }
    }
  }

  // refs and door in intent.md (or spec.md).
  const home = docs.find((d) => d.file === primary);
  if (home?.fm) {
    const { data, keyLine } = home.fm;
    const at = (k) => keyLine[k] || 1;
    const soft = locked ? report.error : report.warn;
    if (unfilled(data.refs)) {
      soft(home.file, at('refs'), 'refs', 'refs are not pinned yet (refs: <repo>@<sha>, …)');
    } else {
      const names = [];
      for (const entry of splitList(data.refs, /\s*,\s*/)) {
        const m = entry.match(/^([A-Za-z0-9_.-]+)@(.*)$/);
        if (!m || !/^[0-9a-fA-F]{7,40}$/.test(m[2])) {
          report.error(home.file, at('refs'), 'refs', `refs entry "${entry}" must be <repo>@<sha> (7-40 hex characters)`);
        }
        if (!m) continue;
        names.push(m[1]);
        if (profile && Object.keys(profile.repos).length && !(m[1] in profile.repos)) {
          report.error(home.file, at('refs'), 'refs', `refs names repo "${m[1]}", which is not in the profile`);
        }
      }
      if (tier && tier !== 'S') {
        const missing = prFiles.map((f) => f.slice(3, -3)).filter((r) => !names.includes(r));
        if (missing.length) report.warn(home.file, at('refs'), 'refs', `refs has no pin for ${missing.join(', ')} (a pr-<repo>.md exists)`);
      }
    }
    if (unfilled(data.door)) soft(home.file, at('door'), 'door', 'door is not set (1-way or 2-way, set at intake)');
    else if (!/^[12]-way$/.test(data.door)) report.error(home.file, at('door'), 'door', `door "${data.door}" must be 1-way or 2-way`);
    if (unfilled(data.appetite)) soft(home.file, at('appetite'), 'appetite', 'appetite is not set (the time and risk accepted, set at intake)');
  }

  // Ids per family: one definition, every reference resolves, retired ids are not cited.
  const fams = familiesFor(tier, taskPrefixes(profile, dir));
  const occ = collectIds(docs, fams);
  const defs = new Map();
  for (const o of occ.filter((x) => x.kind === 'def')) {
    const prev = defs.get(o.id);
    if (prev) report.error(o.file, o.line, 'id-duplicate', `${o.id} is defined more than once (first at ${prev.file}:${prev.line})`);
    else defs.set(o.id, o);
  }
  for (const o of occ.filter((x) => x.kind === 'ref')) {
    const d = defs.get(o.id);
    if (!d) {
      const where = o.homes.map((h) => (h === 'pr-*' ? 'pr-<repo>.md' : h)).join(' or ');
      report.error(o.file, o.line, 'id-undefined', o.inMarker
        ? `[NEEDS CLARIFICATION: ${o.id}] cites ${o.id}, which is not defined`
        : `${o.id} is cited but not defined (its home is ${where})`);
    } else if (d.retired && !(d.file === o.file && d.line === o.line)) {
      report.error(o.file, o.line, 'id-retired', `${o.id} is retired (${d.file}:${d.line}); do not cite it`);
    }
  }
  for (const o of defs.values()) {
    if (o.family !== 'Q' || o.defType !== 'heading' || o.retired) continue;
    checkQuestionCard(docs.find((d) => d.file === o.file), o.line - 1, o.id, report);
  }
  coverageCheck(docs, defs, fams, locked, report);

  // Generic id checks (any id-like token), markers and placeholders.
  for (const d of docs) {
    d.masked.forEach((line, i) => {
      const n = i + 1;
      for (const m of line.matchAll(SUFFIX_RE)) {
        report.error(d.file, n, 'id-suffix', `${m[1]}${m[2]}: no letter suffixes on ids; give it its own number`);
      }
      for (const m of line.matchAll(RANGE_RE)) {
        if (m[5] && prefixOf(m[5]) !== prefixOf(m[1])) continue;
        report.error(d.file, n, 'id-range', `${m[0].trim()}: no id ranges; write each id out`);
      }
      for (const m of line.matchAll(GATE_NUMBER_RE)) {
        report.error(d.file, n, 'gate-name', `${m[0]}: gates have names, not numbers (${GATES.join(', ')})`);
      }
      for (const m of line.matchAll(MARKER_RE)) {
        if (/\bQ-\d+\b/.test(m[1] || '')) continue; // resolution is checked with the other ids
        const msg = '[NEEDS CLARIFICATION] without a Q-n; add a question card and cite it';
        if (locked) report.error(d.file, n, 'marker', `${msg} (status is ${status})`);
        else report.warn(d.file, n, 'marker', msg);
      }
      if (!humanAllowed(d.file)) {
        for (const _ of line.matchAll(HUMAN_RE)) {
          report.error(d.file, n, 'human-marker', '<HUMAN: …> is allowed only in release.md, pr-<repo>.md and spec.md');
        }
      }
      for (const m of line.matchAll(TODO_RE)) report.warn(d.file, n, 'todo', `${m[1]} left in the text`);
    });
  }

  // Token budgets (warnings) and the executor's required reading.
  for (const d of docs) {
    const b = budgetFor(d.file);
    if (b && d.tokens > b) report.warn(d.file, 0, 'budget', `about ${d.tokens} tokens; the budget is ${b}`);
  }
  const intent = docs.find((d) => d.file === 'intent.md');
  for (const d of docs.filter((x) => /^pr-.+\.md$/.test(x.file))) {
    const total = d.tokens + (intent ? intent.tokens : 0);
    if (total > READING_BUDGET) {
      report.warn(d.file, 0, 'reading-budget', `executor required reading (intent.md + ${d.file}, before the Read first sections) is about ${total} tokens; keep it under ${READING_BUDGET}`);
    }
  }

  const needles = forbiddenNeedles(profile);
  forbiddenCheck(dir, needles, report);

  const red = redactor(needles);
  const clean = (f) => ({ ...f, file: red(f.file), message: red(f.message) });
  const order = (a, b) => (a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1);
  return {
    dir: red(dir), profile: profile ? red(profile.path) : null, tier, status,
    errors: errors.map(clean).sort(order), warnings: warnings.map(clean).sort(order),
    summary: { errors: errors.length, warnings: warnings.length },
  };
}

/** Every file:line that cites an id, plus where it is defined. */
export function impact(specDir, id, opts = {}) {
  const dir = resolve(specDir);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) throw new Error(`not a folder: ${specDir}`);
  const profile = opts.profile === false ? null : profileForSpec(dir, opts.profile || undefined);
  const docs = specFiles(dir).map((f) => loadDoc(dir, f));
  const primary = docs.find((d) => d.file === 'intent.md' || d.file === 'spec.md');
  const tier = primary?.fm?.data.tier in TIER_FILES ? primary.fm.data.tier : null;
  const fams = familiesFor(tier, taskPrefixes(profile, dir));
  const defLines = new Map();
  for (const o of collectIds(docs, fams)) if (o.id === id && o.kind === 'def') defLines.set(`${o.file}:${o.line}`, o);
  const re = new RegExp(`${LEFT}${escapeRe(id)}${RIGHT}`, 'g');
  const definitions = [];
  const citations = [];
  for (const d of docs) {
    const own = owners(d.masked);
    d.masked.forEach((line, i) => {
      const hits = [...line.matchAll(re)].length;
      if (!hits) return;
      const def = defLines.get(`${d.file}:${i + 1}`);
      if (def) { definitions.push({ file: d.file, line: i + 1, retired: def.retired }); if (hits === 1) return; }
      const o = own[i];
      const inId = [o.row, o.heading].find((x) => x && x !== id) || null;
      citations.push({ file: d.file, line: i + 1, in: inId });
    });
  }
  const red = redactor(forbiddenNeedles(profile));
  const clean = (x) => ({ ...x, file: red(x.file), ...(x.in ? { in: red(x.in) } : {}) });
  return { id: red(id), definitions: definitions.map(clean), citations: citations.map(clean) };
}

function loc(f) {
  return f.file ? (f.line ? `${f.file}:${f.line}` : f.file) : '(folder)';
}

function main(argv) {
  const args = parseArgs(argv);
  for (const flag of ['json', 'help']) {
    if (typeof args[flag] === 'string') { args._.unshift(args[flag]); args[flag] = true; }
  }
  const fail = (msg) => { process.stderr.write(`spec-lint: ${msg}\n${USAGE}\n`); process.exit(2); };
  if (args.help || args.h) { process.stdout.write(`${USAGE}\n`); return; }
  const dir = args._[0];
  if (!dir) fail('missing <spec-dir>');
  if (!existsSync(dir) || !statSync(dir).isDirectory()) fail(`not a folder: ${dir}`);
  if (args.profile === true) fail('--profile needs a path');
  if (args.profile && !existsSync(resolve(args.profile))) fail(`profile not found: ${args.profile}`);
  if (args.impact === true) fail('--impact needs an id, for example --impact D-3');

  if (args.impact) {
    let id = String(args.impact).trim();
    if (/^[A-Z]+\d+$/.test(id)) id = id.replace(/^([A-Z]+)(\d+)$/, '$1-$2');
    const r = impact(dir, id, { profile: args.profile });
    if (args.json) { process.stdout.write(`${JSON.stringify(r, null, 2)}\n`); return; }
    const out = [];
    if (!r.definitions.length) out.push(`${r.id} is not defined in this folder`);
    for (const d of r.definitions) out.push(`${r.id} defined at ${d.file}:${d.line}${d.retired ? ' (RETIRED)' : ''}`);
    out.push(r.citations.length ? 'cited at:' : 'no citations');
    for (const c of r.citations) out.push(`  ${c.file}:${c.line}${c.in ? ` (in ${c.in})` : ''}`);
    out.push(`spec-lint --impact ${r.id}: ${r.definitions.length} definition(s), ${r.citations.length} citation(s)`);
    process.stdout.write(`${out.join('\n')}\n`);
    return;
  }

  const r = lint(dir, { profile: args.profile });
  if (args.json) {
    process.stdout.write(`${JSON.stringify(r, null, 2)}\n`);
  } else {
    const out = [];
    const block = (title, list) => {
      if (!list.length) return;
      out.push(title);
      for (const f of list) out.push(`  ${loc(f)}  [${f.rule}] ${f.message}`);
    };
    block('ERRORS', r.errors);
    block('WARNINGS', r.warnings);
    out.push(`spec-lint: ${r.errors.length} errors, ${r.warnings.length} warnings`);
    process.stdout.write(`${out.join('\n')}\n`);
  }
  process.exitCode = r.errors.length ? 1 : 0;
}

const self = fileURLToPath(import.meta.url);
let invoked = '';
try { invoked = process.argv[1] ? realpathSync(process.argv[1]) : ''; } catch { invoked = ''; }
if (invoked === self) main(process.argv.slice(2));
