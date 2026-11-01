// Tests for spec-lint.mjs. Run from skills/spec or skills/spec/scripts: node --test (no folder argument)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, readFileSync, writeFileSync, appendFileSync, readdirSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lint, impact, maskLines } from '../spec-lint.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, '..', 'spec-lint.mjs');
const FIX = join(HERE, 'fixtures');
const PROJECT = join(FIX, 'lint-project');
const PROFILE = join(PROJECT, 'spec-profile.md');
const fx = (name) => join(PROJECT, name);

const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
const find = (list, file, rule, text = '') =>
  list.filter((f) => f.file === file && f.rule === rule && f.message.includes(text));
const one = (list, file, rule, text) => assert.equal(find(list, file, rule, text).length, 1,
  `expected one ${rule} in ${file} matching "${text}", got:\n${JSON.stringify(list, null, 2)}`);
const none = (list, rule) => assert.deepEqual(list.filter((f) => f.rule === rule), []);

/** Copy a fixture into a temporary folder; removed after the test. */
function scratch(t, fixture) {
  const root = mkdtempSync(join(tmpdir(), 'spec-lint-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const dir = join(root, 'spec');
  cpSync(fixture, dir, { recursive: true });
  return dir;
}
const edit = (file, fn) => writeFileSync(file, fn(readFileSync(file, 'utf8')));

// ---------- passing folders ----------

for (const [name, tier] of [['good-l', 'L'], ['good-m', 'M'], ['good-s', 'S']]) {
  test(`${name}: a clean tier ${tier} folder has no errors and no warnings`, () => {
    const r = lint(fx(name));
    assert.equal(r.profile, PROFILE, 'finds the profile by walking up');
    assert.equal(r.tier, tier);
    assert.equal(r.status, 'draft');
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.warnings, []);
  });
}

test('without a profile, task prefixes come from pr-<name>.md file names', (t) => {
  const r = lint(join(FIX, 'lint-noprofile'), { profile: false });
  assert.equal(r.profile, null);
  assert.deepEqual(r.errors, []);
  const dir = scratch(t, join(FIX, 'lint-noprofile'));
  appendFileSync(join(dir, 'pr-app.md'), '- Hand over to APP-9.\n');
  one(lint(dir, { profile: false }).errors, 'pr-app.md', 'id-undefined', 'APP-9');
});

test('comments, fenced code and archive/ are ignored; the same text outside them is flagged', (t) => {
  const r = lint(fx('good-l'));
  const text = JSON.stringify(r);
  for (const s of ['D-77', 'D-88', 'D-99', 'X-1b', 'X-2b']) assert.ok(!text.includes(s), s);

  const dir = scratch(t, fx('good-l'));
  edit(join(dir, 'intent.md'), (s) => s.replace('<!--', '').replace('-->', ''));
  const u = lint(dir, { profile: PROFILE });
  one(u.errors, 'intent.md', 'id-range', 'AC-1..3');
  one(u.errors, 'intent.md', 'id-suffix', 'D-1b');
  one(u.errors, 'intent.md', 'id-undefined', 'D-77');
  one(u.errors, 'intent.md', 'gate-name', 'G-4');
  one(u.errors, 'intent.md', 'human-marker', '');
  one(u.warnings, 'intent.md', 'marker', '');
  one(u.warnings, 'intent.md', 'todo', 'TODO');
});

test('maskLines blanks fences and comments but keeps line numbers', () => {
  const lines = ['a D-1', '```', 'D-2', '```', 'b <!-- D-3 --> D-4', '<!--', 'D-5', '-->', 'D-6'];
  const m = maskLines(lines);
  assert.equal(m.length, lines.length);
  assert.ok(m[0].includes('D-1'));
  assert.ok(!m[2].includes('D-2'));
  assert.ok(!m[4].includes('D-3') && m[4].includes('D-4'));
  assert.ok(!m[6].includes('D-5'));
  assert.ok(m[8].includes('D-6'));
});

// ---------- files and front matter ----------

test('required files per tier, with one pr-<repo>.md per repo named in refs', () => {
  const { errors } = lint(fx('bad-files'));
  one(errors, 'questions.md', 'files', 'tier L');
  // refs name api and mobile (new-spec --repos writes only the repos a spec touches).
  one(errors, 'pr-mobile.md', 'files', 'repo in refs');
  assert.equal(find(errors, 'pr-api.md', 'files').length, 0);
  assert.equal(find(errors, 'pr-web.md', 'files').length, 0, 'a profile repo not in refs needs no brief');
});

test('without filled refs, every profile repo needs a brief', (t) => {
  const dir = scratch(t, fx('good-m'));
  edit(join(dir, 'intent.md'), (x) => x.replace(/^refs: .*$/m, 'refs: <HUMAN: refs>'));
  unlinkSync(join(dir, 'pr-web.md'));
  one(lint(dir, { profile: PROFILE }).errors, 'pr-web.md', 'files', 'repo in refs');
});

test('tier M or L without a profile needs at least one pr-<repo>.md', (t) => {
  const dir = scratch(t, join(FIX, 'lint-noprofile'));
  unlinkSync(join(dir, 'pr-app.md'));
  // refs pin app, so the missing brief is named.
  one(lint(dir, { profile: false }).errors, 'pr-app.md', 'files', 'repo in refs');
});

test('front matter: present, flat, with spec, tier and status', () => {
  const { errors } = lint(fx('bad-files'));
  one(errors, 'research.md', 'front-matter', 'missing front matter');
  one(errors, 'test-matrix.md', 'front-matter', 'lacks spec');
  one(errors, 'intent.md', 'front-matter', 'flat');
  one(errors, 'architecture.md', 'front-matter', 'status "approved"');
  one(errors, 'review.md', 'front-matter', 'tier is M');
});

test('every file has the same status', () => {
  const { errors } = lint(fx('bad-files'));
  one(errors, 'decisions.md', 'status', 'locked-v1');
});

test('refs and door format in intent.md', () => {
  const { errors, warnings } = lint(fx('bad-files'));
  one(errors, 'intent.md', 'refs', '"api@xyz123"');
  one(errors, 'intent.md', 'refs', 'repo "mobile"');
  one(errors, 'intent.md', 'door', '3-way');
  assert.equal(find(warnings, 'intent.md', 'refs').filter((w) => /no pin/.test(w.message)).length, 0);
});

test('a pr-<repo>.md whose repo has no pin in refs warns', (t) => {
  const dir = scratch(t, fx('good-m'));
  edit(join(dir, 'intent.md'), (x) => x.replace(/^refs: (.*?), web@[0-9a-f]+$/m, 'refs: $1'));
  one(lint(dir, { profile: PROFILE }).warnings, 'intent.md', 'refs', 'no pin for web');
});

test('unpinned refs warn while draft and fail once locked', (t) => {
  const dir = scratch(t, fx('good-m'));
  edit(join(dir, 'intent.md'), (s) => s.replace(/^refs: .*$/m, 'refs: api@<HUMAN: refs>, web@<HUMAN: refs>'));
  const draft = lint(dir, { profile: PROFILE });
  one(draft.warnings, 'intent.md', 'refs', 'not pinned');
  none(draft.errors, 'refs');
  none(draft.errors, 'human-marker');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.md'))) {
    edit(join(dir, f), (s) => s.replace('status: draft', 'status: locked-v1'));
  }
  one(lint(dir, { profile: PROFILE }).errors, 'intent.md', 'refs', 'not pinned');
});

test('door and appetite placeholders warn while draft and fail once locked', (t) => {
  const dir = scratch(t, fx('good-m'));
  edit(join(dir, 'intent.md'), (s) => s
    .replace(/^door: .*$/m, 'door: <1-way or 2-way, set at intake>')
    .replace(/^appetite: .*$/m, 'appetite: <set at intake>'));
  const draft = lint(dir, { profile: PROFILE });
  one(draft.warnings, 'intent.md', 'door', 'not set');
  one(draft.warnings, 'intent.md', 'appetite', 'not set');
  assert.deepEqual(draft.errors, []);
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.md'))) {
    edit(join(dir, f), (s) => s.replace('status: draft', 'status: locked-v1'));
  }
  const locked = lint(dir, { profile: PROFILE });
  one(locked.errors, 'intent.md', 'door', 'not set');
  one(locked.errors, 'intent.md', 'appetite', 'not set');
});

test('without a profile above the spec folder, the current folder is searched, else a warning says what was skipped', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'spec-lint-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const project = join(root, 'project');
  const spec = join(root, 'outside-specs', 'forbidden');
  cpSync(fx('forbidden'), spec, { recursive: true });
  cpSync(PROFILE, join(project, 'spec-profile.md'));
  cpSync(join(PROJECT, 'forbidden-strings.txt'), join(project, 'forbidden-strings.txt'));
  const fromProject = spawnSync(process.execPath, [SCRIPT, spec, '--json'], { cwd: project, encoding: 'utf8' });
  const j = JSON.parse(fromProject.stdout);
  assert.equal(fromProject.status, 1);
  assert.ok(j.errors.some((e) => e.rule === 'forbidden-string'));
  const elsewhere = spawnSync(process.execPath, [SCRIPT, spec, '--json'], { cwd: root, encoding: 'utf8' });
  const k = JSON.parse(elsewhere.stdout);
  assert.equal(k.profile, null);
  assert.ok(k.warnings.some((w) => w.rule === 'profile' && /forbidden-strings, refs and task-prefix/.test(w.message)));
});

// ---------- coverage ----------

test('coverage: once a test row exists, every AC needs a test row or an "Accepted, no test" row', (t) => {
  const dir = scratch(t, fx('good-m'));
  edit(join(dir, 'pr-web.md'), (s) => s.replace(/^\| T-WEB-1 .*\n/m, ''));
  const draft = lint(dir, { profile: PROFILE });
  one(draft.warnings, 'intent.md', 'coverage', 'AC-1 has no test row');
  none(draft.errors, 'coverage');
  appendFileSync(join(dir, 'pr-web.md'), '\n## Accepted, no test\n| Edge case | Closed by | Reason |\n|---|---|---|\n| AC-1 on old browsers | D-1 | checked by hand |\n');
  none(lint(dir, { profile: PROFILE }).warnings, 'coverage');
});

test('coverage: a test row names a task id or manual; once locked, gaps are errors', (t) => {
  const dir = scratch(t, fx('good-m'));
  edit(join(dir, 'pr-web.md'), (s) => s.replace('| T-WEB-1 | AC-1 | WEB-1 |', '| T-WEB-1 | AC-1 | later |'));
  one(lint(dir, { profile: PROFILE }).warnings, 'pr-web.md', 'coverage', 'T-WEB-1: the task cell');
  edit(join(dir, 'pr-web.md'), (s) => s.replace('| T-WEB-1 | AC-1 | later |', '| T-WEB-1 | D-1 | manual |'));
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.md'))) {
    edit(join(dir, f), (s) => s.replace('status: draft', 'status: locked-v1'));
  }
  const r = lint(dir, { profile: PROFILE });
  one(r.errors, 'intent.md', 'coverage', 'AC-1 has no test row');
  assert.equal(find(r.errors, 'pr-web.md', 'coverage').length, 0, 'manual is a valid task cell');
});

test('budgets leave HTML comments out', (t) => {
  const dir = scratch(t, fx('good-m'));
  appendFileSync(join(dir, 'intent.md'), `\n<!-- ${'guidance '.repeat(2000)} -->\n`);
  none(lint(dir, { profile: PROFILE }).warnings, 'budget');
});

// ---------- ids ----------

test('ids: defined once, every reference resolves, retired ids are not cited', () => {
  const { errors } = lint(fx('bad-ids'));
  one(errors, 'intent.md', 'id-duplicate', 'AC-1');
  one(errors, 'intent.md', 'id-undefined', 'D-9');
  one(errors, 'architecture.md', 'id-retired', 'AC-2');
  one(errors, 'pr-api.md', 'id-undefined', 'API-7');
  assert.equal(find(errors, 'pr-api.md', 'id-undefined', 'WEB-1').length, 0, 'task ids resolve across briefs');
});

test('a first cell outside the home file is a reference; "### D-n options" is not a second definition', () => {
  const { errors } = lint(fx('bad-ids'));
  one(errors, 'architecture.md', 'id-undefined', 'D-5');
  assert.equal(errors.filter((e) => e.message.includes('D-2')).length, 0);
  none(errors.filter((e) => e.file === 'decisions.md'), 'id-duplicate');
});

test('letter suffixes and ranges are errors on any id-like token', () => {
  const { errors } = lint(fx('bad-ids'));
  one(errors, 'intent.md', 'id-suffix', 'D-1b');
  one(errors, 'architecture.md', 'id-suffix', 'X-3b');
  one(errors, 'architecture.md', 'id-suffix', 'AL-WEB-15b');
  one(errors, 'intent.md', 'id-range', 'AC-1..3');
  one(errors, 'architecture.md', 'id-range', 'D-1–3');
  one(errors, 'architecture.md', 'id-range', 'AL-WEB-04..09');
  one(errors, 'architecture.md', 'id-range', 'T-POL-1/2');
  one(errors, 'architecture.md', 'id-range', 'AC-1..AC-3');
});

test('gates have names, not numbers', () => {
  one(lint(fx('bad-ids')).errors, 'architecture.md', 'gate-name', 'G-2');
});

test('the bad-ids folder has exactly the expected errors', () => {
  const r = lint(fx('bad-ids'));
  assert.equal(r.errors.length, 14, JSON.stringify(r.errors, null, 2));
  assert.deepEqual(r.warnings, []);
});

// ---------- question cards ----------

test('question cards: fields, values, Default NONE, option letters and heading', () => {
  const { errors } = lint(fx('bad-questions'));
  const q = (id) => errors.filter((e) => e.message.startsWith(`${id}:`));
  assert.deepEqual(q('Q-1'), []);
  one(errors, 'questions.md', 'question-card', 'Q-2: the line after the heading must have');
  assert.ok(q('Q-2')[0].message.includes('missing Owner, Answer-by'));
  assert.equal(q('Q-3').length, 4);
  for (const field of ['Blocks', 'Default', 'Door', 'Answer-by']) one(errors, 'questions.md', 'question-card', `Q-3: ${field}`);
  one(errors, 'questions.md', 'question-card', 'Q-4: Default NONE needs a gate');
  assert.deepEqual(q('Q-5'), []);
  one(errors, 'questions.md', 'question-card', 'Q-6: the heading must read');
  one(errors, 'questions.md', 'question-card', 'Q-7: Default C has no option');
  one(errors, 'questions.md', 'question-card', 'Q-8: the line after the heading must have');
  assert.equal(errors.length, 9, JSON.stringify(errors, null, 2));
});

test('plain-language warnings for long sentences and code spans in cards', () => {
  const { warnings } = lint(fx('bad-questions'));
  one(warnings, 'questions.md', 'plain-language', 'Q-5: a sentence has 29 words');
  one(warnings, 'questions.md', 'plain-language', 'Q-5: no code spans');
  assert.equal(warnings.length, 2);
});

// ---------- markers ----------

test('markers when locked: unknown Q, bare markers and misplaced HUMAN are errors', () => {
  const { errors, warnings } = lint(fx('bad-markers'));
  one(errors, 'intent.md', 'id-undefined', '[NEEDS CLARIFICATION: Q-9]');
  assert.equal(find(errors, 'intent.md', 'marker', 'locked-v1').length, 2);
  one(errors, 'intent.md', 'human-marker', '');
  assert.equal(find(errors, 'pr-api.md', 'human-marker').length, 0, 'HUMAN is allowed in pr-*.md');
  for (const w of ['TODO', 'TBD', 'FIXME']) one(warnings, 'intent.md', 'todo', w);
  assert.equal(errors.length, 4, JSON.stringify(errors, null, 2));
});

test('a bare marker is only a warning while the status is draft', (t) => {
  const dir = scratch(t, fx('bad-markers'));
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.md'))) {
    edit(join(dir, f), (s) => s.replace('status: locked-v1', 'status: draft'));
  }
  const r = lint(dir, { profile: PROFILE });
  none(r.errors, 'marker');
  assert.equal(find(r.warnings, 'intent.md', 'marker').length, 2);
  one(r.errors, 'intent.md', 'id-undefined', 'Q-9');
});

// ---------- budgets ----------

test('token budgets and the executor reading budget are warnings', (t) => {
  const dir = scratch(t, fx('good-m'));
  appendFileSync(join(dir, 'intent.md'), `\n${'word '.repeat(2600)}\n`);
  appendFileSync(join(dir, 'pr-api.md'), `\n${'word '.repeat(10000)}\n`);
  const r = lint(dir, { profile: PROFILE });
  assert.deepEqual(r.errors, []);
  one(r.warnings, 'intent.md', 'budget', 'budget is 3000');
  one(r.warnings, 'pr-api.md', 'budget', 'budget is 6000');
  one(r.warnings, 'pr-api.md', 'reading-budget', '15000');
  assert.equal(find(r.warnings, 'pr-web.md', 'reading-budget').length, 0);
});

// ---------- forbidden strings ----------

const NEEDLES = readFileSync(join(PROJECT, 'forbidden-strings.txt'), 'utf8')
  .split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

test('forbidden strings: file:line and strings-file line only, never the matched text', () => {
  assert.ok(NEEDLES.length >= 2);
  const r = lint(fx('forbidden'));
  assert.deepEqual(
    r.errors.map((e) => `${e.file}:${e.line} ${e.message}`),
    [
      'archive/notes.md:1 matches line 3 of the forbidden-strings file',
      'spec.md:20 matches line 3 of the forbidden-strings file',
      'spec.md:21 matches line 4 of the forbidden-strings file',
    ],
  );
  const outputs = [
    JSON.stringify(r),
    run(fx('forbidden')).stdout,
    run(fx('forbidden'), '--json').stdout,
    run(fx('forbidden'), '--impact', 'AC-1').stdout,
  ];
  for (const out of outputs) {
    for (const n of NEEDLES) assert.ok(!out.toLowerCase().includes(n.toLowerCase()), 'output leaks a forbidden string');
  }
});

test('output is redacted even when a forbidden string is part of a path or message', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'spec-lint-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const dir = join(root, 'quokka-holdings-spec');
  cpSync(fx('good-s'), dir, { recursive: true });
  writeFileSync(join(root, 'strings.txt'), 'quokka-holdings\n');
  edit(join(dir, 'spec.md'), (s) => s.replace('## Outcome', '## Outcome\nSee QUOKKA-HOLDINGS-1b.'));
  writeFileSync(join(root, 'spec-profile.md'),
    readFileSync(PROFILE, 'utf8').replace('forbidden-strings.txt', 'strings.txt'));
  const out = run(dir, '--json').stdout;
  const j = JSON.parse(out);
  assert.ok(j.errors.some((e) => e.rule === 'forbidden-string'));
  assert.ok(!out.toLowerCase().includes('quokka-holdings'));
});

test('a missing forbidden-strings file is a warning', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'spec-lint-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  cpSync(fx('good-s'), join(root, 'good-s'), { recursive: true });
  writeFileSync(join(root, 'spec-profile.md'),
    readFileSync(PROFILE, 'utf8').replace('forbidden-strings.txt', 'missing.txt'));
  const r = lint(join(root, 'good-s'));
  assert.deepEqual(r.errors, []);
  one(r.warnings, '', 'forbidden-string', 'does not exist');
});

// ---------- impact ----------

test('--impact lists every file:line citing an id, with the citing task or test', () => {
  const r = impact(fx('good-l'), 'D-1');
  assert.deepEqual(r.definitions, [{ file: 'decisions.md', line: 11, retired: false }]);
  const at = r.citations.map((c) => `${c.file}:${c.line}${c.in ? `@${c.in}` : ''}`);
  for (const c of ['intent.md:22@AC-2', 'test-matrix.md:11@T-POL-1', 'pr-api.md:26@API-1', 'pr-api.md:17', 'decisions.md:15']) {
    assert.ok(at.includes(c), `${c} in ${at.join(', ')}`);
  }
  const human = run(fx('good-l'), '--impact', 'D-1');
  assert.equal(human.status, 0);
  assert.match(human.stdout, /D-1 defined at decisions\.md:11/);
  assert.match(human.stdout, /pr-api\.md:26 \(in API-1\)/);
  const json = JSON.parse(run(fx('good-l'), '--impact', 'D-3', '--json').stdout);
  assert.equal(json.definitions[0].retired, true);
  assert.deepEqual(json.citations, []);
});

// ---------- CLI ----------

test('CLI: exit codes, grouped human output and the summary line', () => {
  const ok = run(fx('good-l'));
  assert.equal(ok.status, 0);
  assert.equal(ok.stdout.trim(), 'spec-lint: 0 errors, 0 warnings');

  const bad = run(fx('bad-questions'));
  assert.equal(bad.status, 1);
  const lines = bad.stdout.trimEnd().split('\n');
  assert.equal(lines[0], 'ERRORS');
  assert.ok(lines.includes('WARNINGS'));
  assert.ok(lines.indexOf('WARNINGS') > lines.indexOf('ERRORS'));
  assert.match(lines[1], /^ {2}questions\.md:\d+ {2}\[question-card\] /);
  assert.equal(lines.at(-1), 'spec-lint: 9 errors, 2 warnings');
});

test('CLI: --json gives findings and a summary; --json may come first', () => {
  const r = run('--json', fx('bad-ids'));
  assert.equal(r.status, 1);
  const j = JSON.parse(r.stdout);
  assert.equal(j.summary.errors, j.errors.length);
  assert.equal(j.summary.warnings, j.warnings.length);
  assert.equal(j.tier, 'M');
  for (const f of j.errors) assert.deepEqual(Object.keys(f).sort(), ['file', 'line', 'message', 'rule']);
});

test('CLI: warnings alone never fail', (t) => {
  const dir = scratch(t, fx('good-m'));
  appendFileSync(join(dir, 'intent.md'), '\nThe owner is TBD.\n');
  const r = run(dir, '--profile', PROFILE);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /^WARNINGS$/m);
  assert.match(r.stdout, /spec-lint: 0 errors, 1 warnings\n$/);
});

test('CLI: usage errors exit 2', () => {
  assert.equal(run().status, 2);
  assert.equal(run(join(FIX, 'no-such-folder')).status, 2);
  assert.equal(run(fx('good-l'), '--profile', join(FIX, 'no-such-profile.md')).status, 2);
});
