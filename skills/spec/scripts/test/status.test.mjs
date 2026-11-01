// Tests for scripts/status.mjs. Read-only: runs straight on the fixture folder.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, '..', 'status.mjs');
const FIXTURE = join(HERE, 'fixtures', 'scripts-status');
const SPECS = join(FIXTURE, 'specs');

const run = (cwd, ...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: 'utf8', timeout: 120000 });
const json = (cwd, ...args) => {
  const r = run(cwd, ...args, '--json');
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
};

test('one spec: tier, status, required files and progress counts', () => {
  const [s] = json(FIXTURE, join(SPECS, 'DEMO-9-big')).specs;
  assert.equal(s.slug, 'DEMO-9-big');
  assert.equal(s.tier, 'L');
  assert.equal(s.status, 'locked-v1');
  assert.deepEqual(s.files, { required: 12, present: 9, missing: ['release.md', 'review.md', 'progress-web.json'] });
  assert.equal(s.progress.length, 1);
  const p = s.progress[0];
  assert.equal(p.repo, 'api');
  assert.equal(p.tasks, 6);
  assert.deepEqual(p.counts, { done: 2, in_progress: 1, todo: 2, blocked: 1 });
  assert.equal(p.deviations, 2, 'the empty template entry does not count');
  assert.equal(p.openDeviations, 1);
  assert.deepEqual(p.open, [{ task: 'API-4', from: 'D-6' }]);
  assert.equal(typeof s.lint.available, 'boolean');
});

test('--all lists every spec folder under spec_home, skipping archive/ and folders without intent.md or spec.md', () => {
  const out = json(FIXTURE, '--all');
  assert.equal(out.home, SPECS);
  assert.deepEqual(out.specs.map((s) => s.slug), ['DEMO-9-big', 'broken-progress', 'small-fix']);
  const small = out.specs.find((s) => s.slug === 'small-fix');
  assert.equal(small.tier, 'S');
  assert.deepEqual(small.files, { required: 2, present: 2, missing: [] });
  assert.deepEqual(small.progress[0].counts, { done: 2, in_progress: 0, todo: 0, blocked: 0 });
  assert.equal(small.progress[0].openDeviations, 0);
  const broken = out.specs.find((s) => s.slug === 'broken-progress');
  assert.equal(broken.progress[0].error, 'not valid JSON');
});

test('with no arguments: the current spec folder, or every spec when run elsewhere', () => {
  assert.deepEqual(json(join(SPECS, 'small-fix')).specs.map((s) => s.slug), ['small-fix']);
  assert.equal(json(FIXTURE).specs.length, 3);
});

test('--profile works from any folder', () => {
  const elsewhere = realpathSync(mkdtempSync(join(tmpdir(), 'spec-status-')));
  try {
    const out = json(elsewhere, '--all', '--profile', join(FIXTURE, 'spec-profile.md'));
    assert.equal(out.specs.length, 3);
    const none = run(elsewhere, '--all');
    assert.equal(none.status, 2);
    assert.match(none.stderr, /no spec-profile\.md found/);
  } finally {
    rmSync(elsewhere, { recursive: true, force: true });
  }
});

test('runs spec-lint --json as a child process and reads its counts, whatever the output shape', () => {
  // A private copy of the scripts with a stand-in spec-lint.mjs next to status.mjs.
  const tmp = realpathSync(mkdtempSync(join(tmpdir(), 'spec-status-lint-')));
  try {
    mkdirSync(join(tmp, 'lib'));
    copyFileSync(SCRIPT, join(tmp, 'status.mjs'));
    copyFileSync(join(HERE, '..', 'lib', 'spec.mjs'), join(tmp, 'lib', 'spec.mjs'));
    const shapes = [
      ['{"errors":[{"rule":"id"}],"warnings":[{},{}]}', { errors: 1, warnings: 2 }],
      ['{"summary":{"errors":0,"warnings":3}}', { errors: 0, warnings: 3 }],
      ['{"findings":[{"severity":"error"},{"severity":"warning"},{"level":"warn"}]}', { errors: 1, warnings: 2 }],
      ['not json', { errors: null, warnings: null }],
    ];
    for (const [output, expected] of shapes) {
      writeFileSync(
        join(tmp, 'spec-lint.mjs'),
        `if (!process.argv.includes('--json')) process.exit(9);\nprocess.stdout.write(${JSON.stringify(output)});\nprocess.exitCode = 1;\n`,
      );
      const r = spawnSync(process.execPath, [join(tmp, 'status.mjs'), join(SPECS, 'small-fix'), '--json'], { encoding: 'utf8' });
      assert.equal(r.status, 0, r.stderr);
      const { lint } = JSON.parse(r.stdout).specs[0];
      assert.deepEqual(lint, { available: true, exit: 1, ...expected }, output);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('text report shows each spec with files, lint and progress lines', () => {
  const r = run(FIXTURE, '--all');
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^DEMO-9-big {2}tier L {2}status locked-v1$/m);
  assert.match(r.stdout, /^ {2}files: 9\/12 required present; missing: release\.md, review\.md, progress-web\.json$/m);
  assert.match(r.stdout, /^ {2}lint: (not available|\d+ errors, \d+ warnings|exit \S+ \(output not readable\))$/m);
  assert.match(r.stdout, /^ {2}progress api: 6 tasks \(2 done, 1 in_progress, 2 todo, 1 blocked\); open deviations: 1 \(API-4 vs D-6\)$/m);
  assert.match(r.stdout, /^ {2}progress api: not valid JSON$/m);
  assert.match(r.stdout, /^small-fix {2}tier S {2}status executing$/m);
});

test('a spec_home outside the project is linted with the profile found from the current folder; tokens are shown', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'spec-status-home-')));
  try {
    mkdirSync(join(root, 'project'));
    mkdirSync(join(root, 'outside', 'leaky'), { recursive: true });
    writeFileSync(join(root, 'project', 'strings.txt'), 'quokka holdings\n');
    writeFileSync(join(root, 'project', 'spec-profile.md'),
      '---\nproject: demo\nspec_home: ../outside\nrepos: api=../api\nforbidden_strings_file: strings.txt\n---\n');
    copyFileSync(join(SPECS, 'small-fix', 'spec.md'), join(root, 'outside', 'leaky', 'spec.md'));
    writeFileSync(join(root, 'outside', 'leaky', 'notes.md'), '---\nspec: small-fix\ntier: S\nstatus: executing\n---\nQuokka Holdings\n');
    const out = json(join(root, 'project'), '--all');
    assert.equal(out.specs.length, 1);
    assert.ok(out.specs[0].lint.errors >= 1, JSON.stringify(out.specs[0].lint));
    assert.ok(out.specs[0].tokens.folder > 0);
    assert.deepEqual(Object.keys(out.specs[0].tokens.requiredReading), ['spec.md']);
    assert.match(run(join(root, 'project'), '--all').stdout, /^ {2}tokens: folder \d+; required reading: spec\.md \d+$/m);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
