// Tests for scripts/drift.mjs. Builds two throwaway git repos in os.tmpdir(); never touches real repos.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, '..', 'drift.mjs');
const FIXTURE = join(HERE, 'fixtures', 'scripts-drift');

const GIT_ENV = {
  ...process.env,
  GIT_AUTHOR_NAME: 'Spec Test', GIT_AUTHOR_EMAIL: 'spec-test@example.invalid',
  GIT_COMMITTER_NAME: 'Spec Test', GIT_COMMITTER_EMAIL: 'spec-test@example.invalid',
  GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1',
};
function git(cwd, ...args) {
  const r = spawnSync('git', ['-c', 'commit.gpgsign=false', '-c', 'core.hooksPath=/dev/null', ...args], { cwd, encoding: 'utf8', env: GIT_ENV });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
}
function commit(repo, files, message) {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), text);
  }
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', message);
  return git(repo, 'rev-parse', '--short', 'HEAD');
}

let root;
let pins;
before(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'spec-drift-')));
  cpSync(FIXTURE, root, { recursive: true });

  const app = join(root, 'repos', 'app');
  mkdirSync(app, { recursive: true });
  git(app, 'init', '-q', '-b', 'main');
  const appPin = commit(app, {
    'src/lib.ts': 'export function doThing() {}\nexport const keep = 1;\n',
    'src/other.ts': 'function stable() {}\n',
    'src/same.ts': 'export class Same {\n  method() {}\n}\n',
  }, 'pin');
  commit(app, {
    'src/lib.ts': 'export function doOther() {}\nexport const keep = 1;\n',
    'src/other.ts': 'function stable() {}\n// touched\n',
    'src/new.ts': 'export const fresh = 2;\n',
  }, 'later');
  // origin/main without a remote or a fetch.
  git(app, 'update-ref', 'refs/remotes/origin/main', 'HEAD');

  const lib = join(root, 'repos', 'lib');
  mkdirSync(lib, { recursive: true });
  git(lib, 'init', '-q', '-b', 'qa');
  const libPin = commit(lib, { 'pkg/util.go': 'package pkg\n\nfunc Helper() {}\n' }, 'pin');

  pins = { app: appPin, lib: libPin };
  const fill = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) fill(p);
      else writeFileSync(p, readFileSync(p, 'utf8').replaceAll('{{APP_SHA}}', appPin).replaceAll('{{LIB_SHA}}', libPin));
    }
  };
  fill(join(root, 'specs'));
});
after(() => rmSync(root, { recursive: true, force: true }));

const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: root, encoding: 'utf8' });
const statuses = (out) => Object.fromEntries(out.results.map((r) => [r.ref, r.status]));

test('classifies references against the pin and origin/<base>', () => {
  const r = run(join(root, 'specs', 'clean'), '--json');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.ok, true);
  assert.deepEqual(out.pins, pins);
  assert.deepEqual(statuses(out), {
    'app:src/lib.ts#doThing': 'MISSING_AT_BASE',
    'app:src/lib.ts#keep': 'FILE_CHANGED',
    'app:src/other.ts#stable': 'FILE_CHANGED',
    'app:src/same.ts#Same': 'OK',
    'app:src/same.ts#Same.method': 'OK',
    'lib:pkg/util.go#Helper': 'OK',
  });
});

test('finds references in prose, tables, backticks and code fences, and ignores comments, archive/ and look-alikes', () => {
  const out = JSON.parse(run(join(root, 'specs', 'clean'), '--json').stdout);
  const doThing = out.results.find((r) => r.ref === 'app:src/lib.ts#doThing');
  assert.deepEqual(doThing.cited, ['intent.md:11', 'pr-app.md:12']);
  assert.ok(!out.results.some((r) => r.ref.includes('gone.ts')), 'archive/ is ignored');
  assert.ok(!out.results.some((r) => r.ref.includes('commented.ts')), 'HTML comments are ignored');
  assert.ok(!out.results.some((r) => /example\.com|notarepo|x\.txt/.test(r.ref)));
  const helper = out.results.find((r) => r.ref === 'lib:pkg/util.go#Helper');
  // No origin/qa: the local qa branch is the base (repos without a remote).
  assert.equal(helper.status, 'OK');
  assert.doesNotMatch(helper.detail, /not found locally/);
});

test('exits 1 when a file or symbol is missing at the pin (word match, not substring)', () => {
  const r = run(join(root, 'specs', 'broken'), '--json');
  assert.equal(r.status, 1);
  const out = JSON.parse(r.stdout);
  assert.equal(out.ok, false);
  assert.deepEqual(statuses(out), {
    'app:src/lib.ts#doThin': 'MISSING_AT_PIN',
    'app:src/new.ts#fresh': 'MISSING_AT_PIN',
    'app:src/same.ts#Same': 'OK',
  });
  assert.equal(out.summary.MISSING_AT_PIN, 2);
  const fresh = out.results.find((r) => r.ref === 'app:src/new.ts#fresh');
  assert.equal(fresh.detail, `file not found at ${pins.app}`);
});

test('text report lists each reference with its status and a summary', () => {
  const r = run(join(root, 'specs', 'broken'));
  assert.equal(r.status, 1);
  assert.match(r.stdout, new RegExp(`^drift: broken \\(pins: app@${pins.app}, lib@${pins.lib}\\)`));
  assert.match(r.stdout, /^MISSING_AT_PIN {2}app:src\/new\.ts#fresh {2}\(file not found at \w+\) {2}\[intent\.md:10\]$/m);
  assert.match(r.stdout, /^3 references: 2 MISSING_AT_PIN, 1 OK\.$/m);
});

test('a reference without a usable pin is UNCHECKED and does not fail', () => {
  const r = run(join(root, 'specs', 'unpinned'), '--json');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.results[0].status, 'UNCHECKED');
  assert.match(out.results[0].detail, /no sha pinned for app/);
  assert.match(run(join(root, 'specs', 'unpinned')).stdout, /Warning: 1 references could not be checked\./);
});

test('a missing spec folder is a usage error', () => {
  const r = run(join(root, 'specs', 'nope'));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /not a folder/);
});

test('falls back to a local base branch when origin/<base> does not exist', () => {
  const lib = join(root, 'repos', 'lib');
  // The lib repo has no remote; base_branch qa exists only locally.
  const r = spawnSync('git', ['-C', lib, 'rev-parse', '--verify', '--quiet', 'origin/qa'], { encoding: 'utf8' });
  assert.notEqual(r.status, 0, 'test setup: origin/qa must not exist');
  const out = run(join(root, 'specs', 'clean'), '--json');
  const parsed = JSON.parse(out.stdout);
  const libRefs = parsed.results.filter((x) => x.ref.startsWith('lib:'));
  assert.ok(libRefs.length > 0, 'fixture has lib references');
  for (const ref of libRefs) assert.doesNotMatch(ref.detail || '', /not found locally/);
});

test('"(new)" marks a reference that a task creates: NEW wherever it is cited, never a failure', () => {
  const dir = join(root, 'specs', 'with-new');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'intent.md'), [
    '---', 'spec: with-new', 'tier: M', 'status: draft', `refs: app@${pins.app}`, '---', '# New',
    '- Files: app:src/export.ts#toCsv (new), src/export.test.ts (new)',
    '- Wire app:src/export.ts#toCsv into app:src/same.ts#Same.',
    '- Then `app:src/export.ts#toJson` (new) in backticks.', '',
  ].join('\n'));
  const r = run(dir, '--json');
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const out = JSON.parse(r.stdout);
  assert.deepEqual(statuses(out), {
    'app:src/export.ts#toCsv': 'NEW', 'app:src/export.ts#toJson': 'NEW', 'app:src/same.ts#Same': 'OK',
  });
  assert.deepEqual(out.results.find((x) => x.status === 'NEW').cited, ['intent.md:8', 'intent.md:9']);
});

test('--strict also fails on UNCHECKED references', () => {
  const r = run(join(root, 'specs', 'unpinned'), '--strict', '--json');
  assert.equal(r.status, 1);
  assert.equal(JSON.parse(r.stdout).ok, false);
  assert.match(run('--strict', join(root, 'specs', 'unpinned')).stdout, /Error: 1 references could not be checked \(--strict\)\./);
  assert.equal(run(join(root, 'specs', 'clean'), '--strict').status, 0);
});
