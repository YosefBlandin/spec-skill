#!/usr/bin/env node
// Scaffold a spec folder from the templates, or add one template file to an existing folder.
// See ../references/conventions.md sections 1 to 3.
//
// usage: node new-spec.mjs --tier S|M|L --slug <slug> [--ticket KEY] [--title "text"] [--repos name,name]
//                          [--profile path] [--force]
//        node new-spec.mjs --add <file> --slug <slug> [--profile path] [--force]
// Tier S is one repo: pass --repos <one repo> when the profile has more than one.
// --add renders one template (review.md, questions.md, ...) into the folder, with the folder's front matter values.
// --add pr-<repo>.md also writes progress-<repo>.json (if missing) and adds the repo's pin to refs.
// Pins (refs): origin/<base_branch>, else the local <base_branch>, else HEAD, the same order drift uses for the base.
// Prints the folder (scaffold) or each file written (--add) on stdout. Warnings go to stderr.

import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { parseArgs, parseFrontMatter, profileFor, splitList, TIER_FILES } from './lib/spec.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_TEMPLATES = resolve(HERE, '..', 'assets', 'templates');
const USAGE =
  'usage: new-spec.mjs --tier S|M|L --slug <slug> [--ticket KEY] [--title "text"] [--repos name,name] [--profile path] [--force]\n'
  + '       new-spec.mjs --add <file> --slug <slug> [--profile path] [--force]';

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TICKET = /^[A-Z][A-Z0-9]*-\d+$/;
const TICKET_AT_START = /^([A-Z][A-Z0-9]*-\d+)(?:-(.*))?$/;

function usageError(msg) {
  process.stderr.write(`new-spec: ${msg}\n${USAGE}\n`);
  process.exit(2);
}
function fail(msg) {
  process.stderr.write(`new-spec: ${msg}\n`);
  process.exit(1);
}
const warn = (msg) => process.stderr.write(`new-spec: warning: ${msg}\n`);

/** Lower-case kebab text, cut at a word boundary to at most `max` characters. */
function kebab(text, max = 40) {
  const words = text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  let out = '';
  for (const w of words) {
    const next = out ? `${out}-${w}` : w;
    if (next.length > max && out) break;
    out = next;
  }
  return out.slice(0, max).replace(/-+$/, '');
}

/** Work out { slug, ticket, rest } from --slug, --ticket and --title (conventions section 1). */
function resolveSlug(args) {
  const str = (v) => (typeof v === 'string' ? v.trim() : '');
  let ticket = str(args.ticket);
  let rest = str(args.slug);
  const title = str(args.title);
  if (ticket) {
    ticket = ticket.toUpperCase();
    if (!TICKET.test(ticket)) usageError(`ticket "${ticket}" is not a key like ABC-123`);
    // Accept a slug that already starts with the ticket key.
    if (rest.toUpperCase() === ticket) rest = '';
    else if (rest.toUpperCase().startsWith(`${ticket}-`)) rest = rest.slice(ticket.length + 1);
  } else {
    const m = rest.match(TICKET_AT_START);
    if (m) {
      ticket = m[1];
      rest = m[2] || '';
    }
  }
  if (!rest && title) rest = kebab(title);
  if (!rest) usageError('need --slug (a short kebab title) or --title');
  if (!KEBAB.test(rest)) {
    usageError(`slug "${rest}" must be lower-case kebab case: letters, digits and single dashes, e.g. fdroid-qr-scanner`);
  }
  return { slug: ticket ? `${ticket}-${rest}` : rest, ticket, rest, title };
}

/** Short sha of a revision, or null when it does not exist. */
function revSha(path, rev) {
  const r = spawnSync('git', ['-C', path, 'rev-parse', '--verify', '--quiet', '--short', `${rev}^{commit}`], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

/** Pin for one repo: origin/<base>, else <base>, else HEAD. Null when the path is missing or not a git repo. */
function pinFor(name, path, branch) {
  if (!existsSync(path)) return null;
  const head = revSha(path, 'HEAD');
  if (!head) return null;
  for (const rev of branch ? [`origin/${branch}`, branch] : []) {
    const sha = revSha(path, rev);
    if (!sha) continue;
    if (sha !== head) warn(`repo ${name}: pinned ${rev} at ${sha}; the checkout HEAD is ${head}`);
    return sha;
  }
  warn(`repo ${name}: ${branch ? `neither origin/${branch} nor ${branch} exists locally` : 'no base_branch in the profile'}; pinned HEAD at ${head}`);
  return head;
}

/** name@sha, or name@<HUMAN: refs> with a warning when the repo cannot be read. */
function pinEntry(profile, name) {
  const sha = pinFor(name, profile.repos[name], profile.baseBranch[name]);
  if (!sha) warn(`repo ${name} not found or not a git repo at ${profile.repos[name]}; its ref needs a human`);
  return `${name}@${sha || '<HUMAN: refs>'}`;
}

/** Replace {{key}} placeholders. In JSON templates the values are JSON-escaped. */
function render(text, values, asJson) {
  const unknown = new Set();
  const out = text.replace(/\{\{\s*([A-Za-z_]+)\s*\}\}/g, (whole, key) => {
    if (!(key in values)) {
      unknown.add(whole);
      return whole;
    }
    const v = String(values[key]);
    return asJson ? JSON.stringify(v).slice(1, -1) : v;
  });
  return { out, unknown: [...unknown] };
}

/** Render every planned item; exit before writing anything when a template is broken. */
function renderPlan(plan, templatesDir, target, base, prefixOf, workRepos) {
  const missing = [...new Set(plan.map((p) => p.template))].filter((t) => !existsSync(join(templatesDir, t)));
  if (missing.length) {
    fail(`templates missing in ${templatesDir}: ${missing.join(', ')}. The skill install is incomplete; restore assets/templates.`);
  }
  const outputs = [];
  for (const item of plan) {
    const values = {
      ...base,
      repo: item.repo || workRepos.join(', '),
      prefix: item.repo ? prefixOf(item.repo) : workRepos.map(prefixOf).join(', '),
    };
    const asJson = item.template.endsWith('.json');
    const { out, unknown } = render(readFileSync(join(templatesDir, item.template), 'utf8'), values, asJson);
    if (asJson) {
      try {
        JSON.parse(out);
      } catch (e) {
        fail(`template ${item.template} does not give valid JSON after filling: ${e.message}`);
      }
    }
    if (unknown.length) warn(`${item.out}: unknown placeholders left as is: ${unknown.join(', ')}`);
    outputs.push({ path: join(target, item.out), text: out });
  }
  return outputs;
}

const today = () => new Date().toISOString().slice(0, 10);

/** --add <file>: render one template into an existing spec folder. */
function addFile(args, profile, templatesDir) {
  const name = typeof args.add === 'string' ? args.add.trim() : '';
  const addable = [...new Set(Object.values(TIER_FILES).flat())].filter((f) => f !== 'intent.md' && f !== 'spec.md');
  const pr = name.match(/^pr-([A-Za-z0-9_.-]+)\.md$/);
  if (!pr && !addable.includes(name)) usageError(`--add takes one of ${addable.join(', ')} or pr-<repo>.md`);
  const { slug } = resolveSlug(args);
  const target = join(profile.specHome, slug);
  const primary = ['intent.md', 'spec.md'].find((f) => existsSync(join(target, f)));
  if (!primary) fail(`${target} is not a spec folder (no intent.md or spec.md); scaffold it first`);
  const primaryPath = join(target, primary);
  const primaryText = readFileSync(primaryPath, 'utf8');
  const fm = parseFrontMatter(primaryText).data;
  const tier = (fm.tier || '').toUpperCase();
  const refsNames = /</.test(fm.refs || '') ? [] : splitList(fm.refs, /\s*,\s*/).map((e) => e.split('@')[0].trim()).filter(Boolean);

  const plan = [];
  if (pr) {
    const repo = pr[1];
    if (tier === 'S') usageError('tier S has no pr-<repo>.md; move the spec up to M first (a D-n records why)');
    if (!(repo in profile.repos)) usageError(`repo "${repo}" is not in the profile (profile has: ${Object.keys(profile.repos).join(', ')})`);
    plan.push({ template: 'pr-repo.md', out: name, repo });
    if (!existsSync(join(target, `progress-${repo}.json`))) plan.push({ template: 'progress-repo.json', out: `progress-${repo}.json`, repo });
  } else {
    plan.push({ template: name, out: name, repo: null });
  }
  if (existsSync(join(target, name)) && !args.force) fail(`${join(target, name)} already exists; pass --force to overwrite it`);

  const prefixOf = (repo) => profile.taskPrefix[repo] || repo.toUpperCase();
  const base = {
    spec: fm.spec || slug,
    ticket: fm.ticket || 'none',
    tier: tier || '?',
    status: fm.status || 'draft',
    refs: fm.refs || '',
    title: (primaryText.match(/^# (.+)$/m) || [])[1] || slug,
    date: today(),
    project: profile.project,
  };
  const workRepos = refsNames.length ? refsNames : Object.keys(profile.repos);
  const outputs = renderPlan(plan, templatesDir, target, base, prefixOf, workRepos);

  // A new brief means a new repo in this spec: pin it in refs (conventions section 3).
  let refsLine = null;
  if (pr && !refsNames.includes(pr[1])) {
    if (/</.test(fm.refs || '') || fm.refs === undefined) {
      warn(`refs in ${primary} are not pinned yet; add ${pr[1]}@<sha> yourself`);
    } else {
      const entry = pinEntry(profile, pr[1]);
      refsLine = primaryText.replace(/^refs:[ \t]*([^\n]*?)([ \t]+#[^\n]*)?$/m, (whole, value, comment = '') =>
        `refs: ${value.trim() ? `${value.trim()}, ` : ''}${entry}${comment}`);
    }
  }

  for (const o of outputs) {
    writeFileSync(o.path, o.text);
    process.stdout.write(`${o.path}\n`);
  }
  if (refsLine && refsLine !== primaryText) {
    writeFileSync(primaryPath, refsLine);
    warn(`added the pin for ${pr[1]} to refs in ${primary}`);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || args.h) {
    process.stdout.write(`${USAGE}\n`);
    return;
  }
  const templatesDir = typeof args.templates === 'string' ? resolve(args.templates) : DEFAULT_TEMPLATES;
  const tier = typeof args.tier === 'string' ? args.tier.toUpperCase() : '';
  if (args.add === undefined && !TIER_FILES[tier]) usageError('--tier must be S, M or L');
  if (args.add !== undefined && args.tier !== undefined) usageError('--add works on an existing folder; leave out --tier');
  const { slug, ticket, rest, title } = resolveSlug(args);

  const profile = profileFor(process.cwd(), typeof args.profile === 'string' ? args.profile : undefined);
  if (!profile) {
    fail(
      args.profile
        ? `profile not found: ${args.profile}`
        : 'no spec-profile.md found from this folder upwards; pass --profile <path> or create one (conventions section 6)',
    );
  }
  if (args.add !== undefined) {
    addFile(args, profile, templatesDir);
    return;
  }
  const allRepos = Object.keys(profile.repos);
  if (!allRepos.length) fail(`profile ${profile.path} lists no repos (repos: name=path)`);
  // --repos api,web picks the repos this spec touches (default: every profile repo).
  const picked = typeof args.repos === 'string' ? args.repos.split(',').map((r) => r.trim()).filter(Boolean) : [];
  const unknownRepos = picked.filter((r) => !allRepos.includes(r));
  if (unknownRepos.length) usageError(`--repos names unknown repo(s): ${unknownRepos.join(', ')} (profile has: ${allRepos.join(', ')})`);
  const repoNames = picked.length ? picked : allRepos;
  if (tier === 'S' && repoNames.length !== 1) {
    usageError(`tier S is one repo: pass --repos <one repo> (profile has: ${allRepos.join(', ')})`);
  }

  if (ticket && profile.ticketPrefixes.length && !profile.ticketPrefixes.includes(ticket.split('-')[0])) {
    warn(`ticket prefix of ${ticket} is not in the profile's ticket_prefixes (${profile.ticketPrefixes.join(', ')})`);
  }
  if (!ticket && profile.ticketSource !== 'none') warn(`profile ticket_source is ${profile.ticketSource} but no --ticket was given`);

  // Which files to write, and from which template.
  const plan = TIER_FILES[tier].map((f) => ({ template: f, out: f, repo: null }));
  for (const repo of repoNames) {
    if (tier !== 'S') plan.push({ template: 'pr-repo.md', out: `pr-${repo}.md`, repo });
    plan.push({ template: 'progress-repo.json', out: `progress-${repo}.json`, repo });
  }

  const target = join(profile.specHome, slug);
  if (existsSync(target) && readdirSync(target).length && !args.force) {
    fail(`${target} already exists and is not empty; pass --force to overwrite the scaffold files`);
  }

  // Code pins: name@<short sha> for each repo this spec touches.
  const pins = repoNames.map((name) => pinEntry(profile, name));
  const prefixOf = (repo) => profile.taskPrefix[repo] || repo.toUpperCase();
  const base = {
    spec: slug,
    ticket: ticket || 'none',
    tier,
    status: 'draft',
    refs: pins.join(', '),
    title: title || rest.replace(/-/g, ' '),
    date: today(),
    project: profile.project,
  };

  // Render everything first, so a template error writes nothing.
  const outputs = renderPlan(plan, templatesDir, target, base, prefixOf, repoNames);
  mkdirSync(target, { recursive: true });
  for (const o of outputs) writeFileSync(o.path, o.text);
  process.stdout.write(`${target}\n`);
}

main();
