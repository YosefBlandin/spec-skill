// Shared helpers for the spec scripts: front matter, project profile, id patterns, file listing.
// No dependencies. Node 20+ (ESM). See ../../references/conventions.md for the formats parsed here.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, isAbsolute } from 'node:path';
import { homedir } from 'node:os';

/** Expand a leading ~ to the home directory. */
export function expandHome(p) {
  if (!p) return p;
  return p === '~' ? homedir() : p.startsWith('~/') ? join(homedir(), p.slice(2)) : p;
}

/** Resolve p against base unless it is absolute (after ~ expansion). */
export function resolveFrom(base, p) {
  const e = expandHome(p.trim());
  return isAbsolute(e) ? e : resolve(base, e);
}

/**
 * Parse a flat `key: value` front-matter block at the top of a markdown file.
 * Returns { data, endLine } where endLine is the 1-based line of the closing `---` (0 if none).
 * Inline `# comments` after a value are stripped.
 */
export function parseFrontMatter(text) {
  const lines = text.split('\n');
  if (lines[0].trim() !== '---') return { data: {}, endLine: 0 };
  const data = {};
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === '---') return { data, endLine: i + 1 };
    const m = line.match(/^([A-Za-z0-9_.-]+):\s*(.*)$/);
    if (m) data[m[1]] = m[2].replace(/\s+#.*$/, '').trim();
  }
  return { data: {}, endLine: 0 }; // unterminated block: treat as no front matter
}

/** Split a list value: `a; b` or `a, b`. */
export function splitList(value, sep = /\s*[;,]\s*/) {
  if (!value || value === 'none') return [];
  return value.split(sep).map((s) => s.trim()).filter(Boolean);
}

const PROFILE_CANDIDATES = ['spec-profile.md', join('specs', 'spec-profile.md'), join('docs', 'specs', 'spec-profile.md')];

/** Walk up from startDir looking for a project profile. Returns the absolute path or null. */
export function findProfile(startDir = process.cwd()) {
  let dir = resolve(startDir);
  for (;;) {
    for (const c of PROFILE_CANDIDATES) {
      const p = join(dir, c);
      if (existsSync(p)) return p;
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** Read and normalise a profile file into a plain object. */
export function loadProfile(profilePath) {
  const text = readFileSync(profilePath, 'utf8');
  const { data } = parseFrontMatter(text);
  const base = dirname(profilePath);
  const repos = {};
  for (const pair of splitList(data.repos, /\s*,\s*/)) {
    const [name, path] = pair.split('=').map((s) => s.trim());
    if (name && path) repos[name] = resolveFrom(base, path);
  }
  const perRepo = (prefix) => {
    const out = {};
    for (const [k, v] of Object.entries(data)) if (k.startsWith(prefix + '.')) out[k.slice(prefix.length + 1)] = v;
    return out;
  };
  const verify = {};
  for (const [name, v] of Object.entries(perRepo('verify'))) verify[name] = splitList(v, /\s*;\s*/);
  const preflight = splitList(data.preflight, /\s*;\s*/).map((entry) => {
    const [cmd, expect] = entry.split('=>').map((s) => (s || '').trim());
    return { cmd, expect: expect || '' };
  });
  return {
    path: profilePath,
    dir: base,
    project: data.project || 'project',
    specHome: data.spec_home ? resolveFrom(base, data.spec_home) : base,
    ticketSource: data.ticket_source || 'none',
    ticketPrefixes: splitList(data.ticket_prefixes, /\s*,\s*/),
    repos,
    taskPrefix: perRepo('task_prefix'),
    baseBranch: perRepo('base_branch'),
    verify,
    preflight,
    forbiddenStringsFile: data.forbidden_strings_file ? resolveFrom(base, data.forbidden_strings_file) : null,
    environmentFile: data.environment_file ? resolveFrom(base, data.environment_file) : null,
    raw: data,
  };
}

/** Load the profile for a directory, honouring an explicit --profile path. Returns null if none. */
export function profileFor(dir, explicitPath) {
  const p = explicitPath ? resolve(explicitPath) : findProfile(dir);
  return p && existsSync(p) ? loadProfile(p) : null;
}

/**
 * The profile for a spec folder: --profile if given; else walk up from the folder; else walk up from the current
 * directory (for a spec_home outside the project). Returns null if none.
 */
export function profileForSpec(specDir, explicitPath) {
  if (explicitPath) return profileFor(specDir, explicitPath);
  return profileFor(specDir) || profileFor(process.cwd());
}

/** Markdown files of a spec folder (top level only; archive/ is ignored). */
export function specFiles(specDir) {
  return readdirSync(specDir)
    .filter((f) => f.endsWith('.md') && statSync(join(specDir, f)).isFile())
    .sort();
}

/** Approximate token count. */
export const approxTokens = (text) => Math.ceil(text.length / 4);

/** Token count for budgets: HTML comments (template guidance) do not count. */
export const budgetTokens = (text) => approxTokens(text.replace(/<!--[\s\S]*?(?:-->|$)/g, ''));

/** Budgets in tokens per file name (pr-*.md handled by prefix). */
export const BUDGETS = {
  'spec.md': 2500, 'intent.md': 3000, 'decisions.md': 5000, 'questions.md': 4000, 'research.md': 12000,
  'architecture.md': 12000, 'test-matrix.md': 7000, 'release.md': 5000, 'review.md': 5000, 'pr-*': 6000,
};
export const budgetFor = (file) => (file.startsWith('pr-') ? BUDGETS['pr-*'] : BUDGETS[file]);

/** Files required per tier (pr-<repo>.md checked separately). */
export const TIER_FILES = {
  S: ['spec.md'],
  M: ['intent.md', 'decisions.md', 'architecture.md'],
  L: ['intent.md', 'decisions.md', 'questions.md', 'research.md', 'architecture.md', 'test-matrix.md', 'release.md', 'review.md'],
};

/**
 * Id families. `home` lists the files where definitions may appear, by tier.
 * Task ids use the profile's task prefixes, so they are built at runtime (see taskFamily).
 */
export const FAMILIES = {
  AC: { re: 'AC-\\d+', home: { S: ['spec.md'], M: ['intent.md'], L: ['intent.md'] } },
  D: { re: 'D-\\d+', home: { S: ['spec.md'], M: ['decisions.md'], L: ['decisions.md'] } },
  Q: { re: 'Q-\\d+', home: { S: ['spec.md'], M: ['intent.md', 'questions.md'], L: ['questions.md'] } },
  RK: { re: 'RK-\\d+', home: { S: ['spec.md'], M: ['architecture.md'], L: ['architecture.md'] } },
  F: { re: 'F-\\d+', home: { S: ['spec.md'], M: ['architecture.md'], L: ['research.md'] } },
  T: { re: 'T-[A-Z][A-Z0-9]*-\\d+', home: { S: ['spec.md'], M: ['pr-*'], L: ['test-matrix.md'] } },
};

/** Task family for the given prefixes (e.g. ['API','WEB']). Home: pr-*.md, or spec.md for S. */
export function taskFamily(prefixes) {
  const list = prefixes.length ? prefixes : ['TASK'];
  return { re: `(?:${list.join('|')})-\\d+`, home: { S: ['spec.md'], M: ['pr-*'], L: ['pr-*'] } };
}

/** True if file name matches one of the home patterns. */
export const isHome = (file, homes) => homes.some((h) => (h === 'pr-*' ? file.startsWith('pr-') : h === file));

/** Read a JSON file or return null. */
export function readJson(p) {
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

/** Parse `--flag value` / `--flag` / positional args. */
export function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) { out[key] = next; i++; } else out[key] = true;
    } else out._.push(a);
  }
  return out;
}
