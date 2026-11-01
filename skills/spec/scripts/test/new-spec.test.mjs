// Tests for scripts/new-spec.mjs. Each test works on a copy of the fixture in os.tmpdir() with throwaway git repos.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPTS = join(HERE, '..');
const SCRIPT = join(SCRIPTS, 'new-spec.mjs');
const FIXTURE = join(HERE, 'fixtures', 'scripts-new-spec');
const REAL_TEMPLATES = join(SCRIPTS, '..', 'assets', 'templates');
const TEMPLATES = join(FIXTURE, 'templates');

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
function makeRepo(dir) {
  mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q', '-b', 'main');
  writeFileSync(join(dir, 'README.txt'), 'demo\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'init');
  return git(dir, 'rev-parse', '--short', 'HEAD');
}

const temps = [];
after(() => temps.forEach((d) => rmSync(d, { recursive: true, force: true })));

/** A copy of the fixture project with api and web repos. Returns { root, shas }. */
function project({ withWeb = true } = {}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'spec-new-')));
  temps.push(root);
  cpSync(FIXTURE, root, { recursive: true });
  const shas = { api: makeRepo(join(root, 'repos', 'api')) };
  if (withWeb) shas.web = makeRepo(join(root, 'repos', 'web'));
  return { root, shas };
}
const run = (cwd, ...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: 'utf8' });
const read = (...p) => readFileSync(join(...p), 'utf8');

test('S tier writes spec.md and one progress file for the one repo it names, and pins only that repo', () => {
  const { root, shas } = project();
  const r = run(root, '--tier', 'S', '--slug', 'fdroid-qr-scanner', '--repos', 'api', '--templates', TEMPLATES);
  assert.equal(r.status, 0, r.stderr);
  const dir = join(root, 'specs', 'fdroid-qr-scanner');
  assert.equal(r.stdout.trim(), dir);
  assert.deepEqual(readdirSync(dir).sort(), ['progress-api.json', 'spec.md']);
  const spec = read(dir, 'spec.md');
  assert.match(spec, /^spec: fdroid-qr-scanner$/m);
  assert.match(spec, /^ticket: none$/m);
  assert.match(spec, /^tier: S$/m);
  assert.match(spec, /^status: draft$/m);
  assert.match(spec, new RegExp(`^refs: api@${shas.api}$`, 'm'));
  assert.match(spec, /Repos: api\. Task prefixes: API\./);
  assert.doesNotMatch(spec, /\{\{/);
  const progress = JSON.parse(read(dir, 'progress-api.json'));
  assert.equal(progress.spec, 'fdroid-qr-scanner');
  assert.equal(progress.repo, 'api');
  assert.equal(progress.tasks[0].id, 'API-0');
});

test('M tier with a ticket prefixes the slug and writes one brief and progress file per repo', () => {
  const { root } = project();
  const r = run(root, '--tier', 'm', '--slug', 'page-view-logs', '--ticket', 'demo-12', '--templates', TEMPLATES);
  assert.equal(r.status, 0, r.stderr);
  const dir = join(root, 'specs', 'DEMO-12-page-view-logs');
  assert.equal(r.stdout.trim(), dir);
  assert.deepEqual(readdirSync(dir).sort(), [
    'architecture.md', 'decisions.md', 'intent.md', 'pr-api.md', 'pr-web.md', 'progress-api.json', 'progress-web.json',
  ]);
  assert.match(read(dir, 'intent.md'), /^ticket: DEMO-12$/m);
  assert.match(read(dir, 'intent.md'), /^tier: M$/m);
  assert.match(read(dir, 'intent.md'), /Repos: api, web\. Task prefixes: API, WEB\./);
  assert.match(read(dir, 'pr-web.md'), /# Brief: web/);
  assert.match(read(dir, 'pr-web.md'), /### WEB-0 · Record baselines/);
  assert.equal(JSON.parse(read(dir, 'progress-web.json')).brief, 'pr-web.md@draft');
  for (const f of readdirSync(dir)) assert.doesNotMatch(read(dir, f), /\{\{/, f);
});

test('L tier writes the full file set and never copies spec-profile.md', () => {
  const { root } = project();
  const r = run(root, '--tier', 'L', '--slug', 'DEMO-7-audit-trail', '--templates', TEMPLATES);
  assert.equal(r.status, 0, r.stderr);
  const dir = join(root, 'specs', 'DEMO-7-audit-trail');
  assert.deepEqual(readdirSync(dir).sort(), [
    'architecture.md', 'decisions.md', 'intent.md', 'pr-api.md', 'pr-web.md', 'progress-api.json', 'progress-web.json',
    'questions.md', 'release.md', 'research.md', 'review.md', 'test-matrix.md',
  ]);
  assert.match(read(dir, 'intent.md'), /^ticket: DEMO-7$/m);
});

test('the slug can come from --title, and JSON values are escaped', () => {
  const { root } = project();
  const r = run(root, '--tier', 'S', '--title', 'Add the "QR" scanner to F-Droid builds now please', '--repos', 'api', '--templates', TEMPLATES);
  assert.equal(r.status, 0, r.stderr);
  const dir = join(root, 'specs', 'add-the-qr-scanner-to-f-droid-builds-now');
  assert.equal(r.stdout.trim(), dir);
  assert.equal(JSON.parse(read(dir, 'progress-api.json')).title, 'Add the "QR" scanner to F-Droid builds now please');
});

test('--profile works from any folder', () => {
  const { root } = project();
  const elsewhere = realpathSync(mkdtempSync(join(tmpdir(), 'spec-new-cwd-')));
  temps.push(elsewhere);
  const r = run(elsewhere, '--tier', 'S', '--slug', 'from-elsewhere', '--repos', 'api', '--profile', join(root, 'spec-profile.md'), '--templates', TEMPLATES);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(join(root, 'specs', 'from-elsewhere', 'spec.md')));
});

test('refuses to overwrite a folder unless --force is given', () => {
  const { root } = project();
  const args = ['--tier', 'S', '--slug', 'twice', '--repos', 'api', '--templates', TEMPLATES];
  assert.equal(run(root, ...args).status, 0);
  const specPath = join(root, 'specs', 'twice', 'spec.md');
  writeFileSync(specPath, 'edited by hand\n');
  const again = run(root, ...args);
  assert.equal(again.status, 1);
  assert.match(again.stderr, /already exists/);
  assert.equal(read(specPath), 'edited by hand\n');
  const forced = run(root, ...args, '--force');
  assert.equal(forced.status, 0, forced.stderr);
  assert.match(read(specPath), /^spec: twice$/m);
});

test('rejects a slug that is not kebab case, a bad ticket and a bad tier', () => {
  const { root } = project();
  for (const args of [
    ['--tier', 'S', '--slug', 'Not_Kebab'],
    ['--tier', 'S', '--slug', 'double--dash'],
    ['--tier', 'S', '--slug', 'ok-slug', '--ticket', 'nodigits'],
    ['--tier', 'X', '--slug', 'ok-slug'],
    ['--tier', 'S'],
  ]) {
    const r = run(root, ...args, '--templates', TEMPLATES);
    assert.notEqual(r.status, 0, args.join(' '));
    assert.equal(r.stdout, '');
  }
  assert.equal(existsSync(join(root, 'specs')), false);
});

test('fails with a clear message when templates are missing, and writes nothing', () => {
  const { root } = project();
  const empty = join(root, 'no-templates');
  mkdirSync(empty);
  const r = run(root, '--tier', 'M', '--slug', 'no-templates', '--templates', empty);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /templates missing in .*: intent\.md, decisions\.md, architecture\.md, pr-repo\.md, progress-repo\.json/);
  assert.equal(existsSync(join(root, 'specs', 'no-templates')), false);
});

test('a repo that is missing gets a HUMAN ref', () => {
  const { root, shas } = project({ withWeb: false });
  const r = run(root, '--tier', 'M', '--slug', 'half-pinned', '--templates', TEMPLATES);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /repo web not found/);
  assert.match(read(root, 'specs', 'half-pinned', 'intent.md'), new RegExp(`^refs: api@${shas.api}, web@<HUMAN: refs>$`, 'm'));
});

test('fails when no profile can be found', () => {
  const lonely = realpathSync(mkdtempSync(join(tmpdir(), 'spec-new-noprofile-')));
  temps.push(lonely);
  const r = run(lonely, '--tier', 'S', '--slug', 'nowhere', '--templates', TEMPLATES);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no spec-profile\.md found/);
});

// Integration with the real templates and spec-lint, once both exist.
const realReady = ['spec.md', 'intent.md', 'decisions.md', 'questions.md', 'research.md', 'architecture.md', 'test-matrix.md',
  'release.md', 'review.md', 'pr-repo.md', 'progress-repo.json'].every((f) => existsSync(join(REAL_TEMPLATES, f)));
const lintScript = join(SCRIPTS, 'spec-lint.mjs');

test('real templates scaffold every tier with no placeholders left and 0 lint errors', { skip: !realReady && 'real templates not written yet' }, () => {
  const { root } = project();
  for (const tier of ['S', 'M', 'L']) {
    const slug = `real-${tier.toLowerCase()}`;
    const r = run(root, '--tier', tier, '--slug', slug, '--ticket', 'DEMO-1', ...(tier === 'S' ? ['--repos', 'api'] : []));
    assert.equal(r.status, 0, r.stderr);
    const dir = r.stdout.trim();
    for (const f of readdirSync(dir)) {
      const text = read(dir, f);
      assert.doesNotMatch(text, /\{\{\s*(spec|ticket|tier|status|refs|repo|prefix)\s*\}\}/, `${tier} ${f}`);
      if (f.endsWith('.json')) JSON.parse(text);
    }
    if (existsSync(lintScript)) {
      const lint = spawnSync(process.execPath, [lintScript, dir, '--json'], { cwd: root, encoding: 'utf8' });
      assert.equal(lint.status, 0, `spec-lint on a fresh ${tier} scaffold:\n${lint.stdout}${lint.stderr}`);
      // G-intake cannot pass on an untouched scaffold: appetite (and door, above S) still need intake answers.
      const rules = JSON.parse(lint.stdout).warnings.map((w) => w.rule);
      assert.ok(rules.includes('appetite'), `${tier}: ${rules}`);
      if (tier !== 'S') assert.ok(rules.includes('door'), `${tier}: ${rules}`);
      // Template examples live in comments, so a fresh scaffold defines no ids beyond the baseline task.
      for (const f of readdirSync(dir).filter((x) => x.endsWith('.md'))) {
        assert.doesNotMatch(read(dir, f).replace(/<!--[\s\S]*?-->/g, ''), /^\| (AC|D|RK|F|T-[A-Z]+)-\d+ \|/m, `${tier} ${f}`);
      }
    }
  }
});

test('--repos picks a subset of profile repos and rejects unknown names', () => {
  const { root } = project();
  const r = run(root, '--tier', 'M', '--slug', 'only-web', '--repos', 'web', '--templates', TEMPLATES);
  assert.equal(r.status, 0, r.stderr);
  const dir = join(root, 'specs', 'only-web');
  const files = readdirSync(dir).sort();
  assert.ok(files.includes('pr-web.md') && files.includes('progress-web.json'));
  assert.ok(!files.includes('pr-api.md') && !files.includes('progress-api.json'));
  const bad = run(root, '--tier', 'M', '--slug', 'bad-repo', '--repos', 'nope', '--templates', TEMPLATES);
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /unknown repo/);
});

test('tier S needs exactly one repo when the profile has several', () => {
  const { root } = project();
  for (const extra of [[], ['--repos', 'api,web']]) {
    const r = run(root, '--tier', 'S', '--slug', 'too-many', ...extra, '--templates', TEMPLATES);
    assert.equal(r.status, 2, extra.join(' '));
    assert.match(r.stderr, /tier S is one repo/);
  }
  assert.equal(existsSync(join(root, 'specs', 'too-many')), false);
});

test('pins origin/<base_branch> before the local base branch and HEAD, and warns when HEAD differs', () => {
  const { root } = project();
  const api = join(root, 'repos', 'api');
  const basePin = git(api, 'rev-parse', '--short', 'HEAD');
  git(api, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  git(api, 'checkout', '-q', '-b', 'feature');
  writeFileSync(join(api, 'feature.txt'), 'work\n');
  git(api, 'add', '.');
  git(api, 'commit', '-q', '-m', 'feature work');
  const r = run(root, '--tier', 'M', '--slug', 'pinned', '--repos', 'api', '--templates', TEMPLATES);
  assert.equal(r.status, 0, r.stderr);
  assert.match(read(root, 'specs', 'pinned', 'intent.md'), new RegExp(`^refs: api@${basePin}$`, 'm'));
  assert.match(r.stderr, /repo api: pinned origin\/main at \w+; the checkout HEAD is \w+/);
});

test('--add renders one template into an existing folder with its front matter values', () => {
  const { root } = project();
  assert.equal(run(root, '--tier', 'M', '--slug', 'DEMO-3-add-later', '--repos', 'api').status, 0);
  const dir = join(root, 'specs', 'DEMO-3-add-later');
  const r = run(root, '--add', 'review.md', '--slug', 'DEMO-3-add-later');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stdout.trim(), join(dir, 'review.md'));
  const review = read(dir, 'review.md');
  assert.match(review, /^spec: DEMO-3-add-later$/m);
  assert.match(review, /^ticket: DEMO-3$/m);
  assert.match(review, /^tier: M$/m);
  assert.doesNotMatch(review, /\{\{/);
  const again = run(root, '--add', 'review.md', '--slug', 'DEMO-3-add-later');
  assert.equal(again.status, 1);
  assert.match(again.stderr, /already exists/);
  const bad = run(root, '--add', 'notes.md', '--slug', 'DEMO-3-add-later');
  assert.equal(bad.status, 2);
  assert.equal(run(root, '--add', 'review.md', '--slug', 'no-such-spec').status, 1);
});

test('--add pr-<repo>.md writes the brief and progress file and pins the repo in refs', () => {
  const { root, shas } = project();
  assert.equal(run(root, '--tier', 'M', '--slug', 'grow', '--repos', 'api').status, 0);
  const dir = join(root, 'specs', 'grow');
  const r = run(root, '--add', 'pr-web.md', '--slug', 'grow');
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(join(dir, 'pr-web.md')) && existsSync(join(dir, 'progress-web.json')));
  assert.match(read(dir, 'intent.md'), new RegExp(`^refs: api@${shas.api}, web@${shas.web}$`, 'm'));
  const lint = spawnSync(process.execPath, [lintScript, dir], { cwd: root, encoding: 'utf8' });
  assert.equal(lint.status, 0, lint.stdout);
  assert.equal(run(root, '--add', 'pr-nope.md', '--slug', 'grow').status, 2);
});
