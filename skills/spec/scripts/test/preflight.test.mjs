// Tests for scripts/preflight.mjs. Runs on a copy of the fixture in os.tmpdir() with a throwaway git repo.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, '..', 'preflight.mjs');
const FIXTURE = join(HERE, 'fixtures', 'scripts-preflight');
const FAKE_TOKEN = ['ghp', 'abcdefghijklmnopqrstuvwxyz0123456789'].join('_');

const temps = [];
after(() => temps.forEach((d) => rmSync(d, { recursive: true, force: true })));

function project() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'spec-preflight-')));
  temps.push(root);
  cpSync(FIXTURE, root, { recursive: true });
  // The fake token is built here so no token-shaped string sits in the fixture files.
  const profile = join(root, 'spec-profile.md');
  writeFileSync(profile, readFileSync(profile, 'utf8').replaceAll('__TOKEN__', FAKE_TOKEN));
  const good = join(root, 'repos', 'good');
  mkdirSync(good, { recursive: true });
  const r = spawnSync('git', ['init', '-q', good], { encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null' } });
  assert.equal(r.status, 0, r.stderr);
  mkdirSync(join(root, 'repos', 'plain'), { recursive: true });
  return root;
}
const run = (cwd, ...args) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: 'utf8', timeout: 60000 });

test('reports PASS and FAIL per check, checks repos, and exits 1 on any failure', () => {
  const root = project();
  const r = run(root, '--json');
  assert.equal(r.status, 1, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.ok, false);
  const by = Object.fromEntries(out.checks.map((c) => [c.name, c]));
  assert.equal(by['echo preflight-ok => preflight-ok'].status, 'PASS');
  assert.equal(by['echo preflight-ok => preflight-ok'].detail, 'preflight-ok');
  assert.equal(by['echo something else => not-there'].status, 'FAIL');
  assert.match(by['echo something else => not-there'].detail, /^exit 0: something else$/);
  assert.equal(by.true.status, 'PASS', 'no expected text: exit code 0 passes');
  assert.equal(by.false.status, 'FAIL');
  assert.equal(by['repo good'].status, 'PASS');
  assert.equal(by['repo plain'].status, 'FAIL');
  assert.equal(by['repo plain'].detail, 'not a git repo');
  assert.equal(by['repo gone'].status, 'FAIL');
  assert.equal(by['repo gone'].detail, 'path not found');
});

test('never prints secrets or environment values, and truncates output', () => {
  const root = project();
  const r = run(root, '--json');
  const out = JSON.parse(r.stdout);
  const secret = out.checks.find((c) => c.name.startsWith('echo DEMO_TOKEN'));
  assert.equal(secret.status, 'FAIL');
  assert.doesNotMatch(secret.detail, /ghp_/);
  assert.match(secret.detail, /DEMO_TOKEN=\[redacted\]/);
  const bare = out.checks.find((c) => c.name.startsWith('echo found'));
  assert.equal(bare.detail, 'exit 0: found [redacted] here');
  assert.equal(bare.name, 'echo found [redacted] here => never-printed', 'the command text is redacted too');
  const long = out.checks.find((c) => c.name.startsWith('printf'));
  assert.ok(long.detail.length <= 'exit 0: '.length + 120, `detail is ${long.detail.length} chars`);
  const env = out.checks.find((c) => c.name.startsWith('env'));
  assert.equal(env.status, 'FAIL');
  // The cut can land inside the last "[redacted]", leaving "=[red...".
  const whole = env.detail.replace(/=\[[a-z]*\.\.\.$/, '');
  assert.doesNotMatch(whole, /=(?!\[redacted\])/, 'every NAME=value is redacted (the tail may be cut)');
  if (process.env.HOME) assert.ok(!env.detail.includes(`=${process.env.HOME}`));
  // The text report must not leak either.
  const text = run(root).stdout;
  assert.ok(!text.includes(FAKE_TOKEN));
  assert.ok(!r.stdout.includes(FAKE_TOKEN));
  assert.match(text, /^FAIL {2}echo something else => not-there/m);
  assert.match(text, /^PASS {2}repo good \(/m);
  assert.match(text, /checks failed\.$/m);
});

test('passes and exits 0 when every check passes; stderr counts as output', () => {
  const root = project();
  const r = run(root, '--profile', join(root, 'passing-profile.md'));
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /^PASS {2}echo to-stderr >&2 => to-stderr/m);
  assert.match(r.stdout, /All 3 checks passed\./);
});

test('a command that runs past the timeout fails without hanging', () => {
  const root = project();
  const started = Date.now();
  const r = run(root, '--profile', join(root, 'timeout-profile.md'), '--timeout', '1', '--json');
  assert.equal(r.status, 1);
  assert.ok(Date.now() - started < 8000, 'returned soon after the timeout');
  const check = JSON.parse(r.stdout).checks[0];
  assert.equal(check.status, 'FAIL');
  assert.equal(check.detail, 'timed out after 1 s');
});

test('fails clearly when there is no profile', () => {
  const lonely = realpathSync(mkdtempSync(join(tmpdir(), 'spec-preflight-none-')));
  temps.push(lonely);
  const r = run(lonely);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no spec-profile\.md found/);
});
