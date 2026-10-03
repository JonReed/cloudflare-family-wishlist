import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { updateFork } from './update-fork.ts';
import { cloudflareBuildState } from './verify-update-build.ts';

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'wishlist-fork-test-'));
  const upstream = join(directory, 'upstream');
  const root = join(directory, 'household');
  const remote = join(directory, 'remote.git');
  mkdirSync(upstream);
  const git = (cwd: string, ...args: string[]) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  const configure = (cwd: string) => {
    git(cwd, 'config', 'user.name', 'Test');
    git(cwd, 'config', 'user.email', 'test@example.invalid');
  };
  const commit = (cwd: string, name: string, value: string) => {
    writeFileSync(join(cwd, name), value);
    git(cwd, 'add', '--', name);
    git(cwd, 'commit', '-m', name);
    return git(cwd, 'rev-parse', 'HEAD');
  };
  git(upstream, 'init', '-b', 'main');
  configure(upstream);
  mkdirSync(join(upstream, '.github'));
  commit(upstream, '.gitignore', '.wishlist-installation.json\n');
  commit(upstream, '.github/local.yml', 'original workflow\n');
  const initial = commit(upstream, 'app.txt', 'first release\n');
  git(upstream, 'branch', 'stable');
  git(directory, 'init', '--bare', remote);
  git(directory, 'clone', upstream, root);
  configure(root);
  git(root, 'remote', 'set-url', 'origin', remote);
  git(root, 'push', 'origin', 'main');
  const release = (value: string) => {
    const sha = commit(upstream, 'app.txt', value);
    git(upstream, 'branch', '-f', 'stable', sha);
    return sha;
  };
  return {
    root,
    upstream,
    remote,
    initial,
    git,
    commit,
    release,
    cleanup: () => rmSync(directory, { recursive: true, force: true })
  };
}

await test('a stable release updates a household, preserves workflows and settings, and makes a normal push', () => {
  const f = fixture();
  try {
    f.commit(f.root, '.github/local.yml', 'household workflow\n');
    writeFileSync(join(f.root, '.wishlist-installation.json'), 'private installation settings');
    const released = f.release('second release\n');
    f.commit(f.upstream, '.github/local.yml', 'upstream workflow requiring extra permissions\n');
    f.git(f.upstream, 'branch', '-f', 'stable', 'HEAD');
    const target = f.git(f.upstream, 'rev-parse', 'stable');
    const before = f.git(f.root, 'rev-parse', 'HEAD');
    const result = updateFork({ ...f, apply: true });
    assert.equal(result.status, 'updated');
    assert.equal(result.sourceCommit, target);
    assert.notEqual(target, released);
    assert.equal(readFileSync(join(f.root, 'app.txt'), 'utf8'), 'second release\n');
    assert.equal(readFileSync(join(f.root, '.github/local.yml'), 'utf8'), 'household workflow\n');
    assert.equal(
      readFileSync(join(f.root, '.wishlist-installation.json'), 'utf8'),
      'private installation settings'
    );
    assert.equal(f.git(f.root, 'rev-parse', 'HEAD^'), before);
    assert.equal(f.git(f.remote, 'rev-parse', 'main'), result.deploymentCommit);
    assert.equal(f.git(f.root, 'status', '--porcelain'), '');
    assert.equal(updateFork({ ...f, apply: true }).status, 'current');
    f.release('third release\n');
    assert.equal(updateFork({ ...f, apply: true }).status, 'updated');
    assert.equal(readFileSync(join(f.root, 'app.txt'), 'utf8'), 'third release\n');
  } finally {
    f.cleanup();
  }
});

await test('a repair installed from main is never downgraded to an older release', () => {
  const f = fixture();
  try {
    const unreleased = f.commit(f.upstream, 'app.txt', 'newer than stable\n');
    f.git(f.root, 'fetch', f.upstream, 'main');
    f.git(f.root, 'merge', '--ff-only', 'FETCH_HEAD');
    assert.deepEqual(updateFork(f), { status: 'ahead', sourceCommit: unreleased });
    assert.equal(updateFork({ ...f, apply: true }).status, 'heartbeat');
    assert.equal(readFileSync(join(f.root, 'app.txt'), 'utf8'), 'newer than stable\n');
    f.release('next stable\n');
    assert.equal(updateFork({ ...f, apply: true }).status, 'updated');
  } finally {
    f.cleanup();
  }
});

await test('custom application changes stop updates without overwriting local or remote source', () => {
  const f = fixture();
  try {
    const custom = f.commit(f.root, 'app.txt', 'family customisation\n');
    f.release('next stable\n');
    assert.throws(
      () => updateFork({ ...f, apply: true }),
      /contains application or configuration changes/
    );
    assert.equal(f.git(f.root, 'rev-parse', 'HEAD'), custom);
    assert.equal(f.git(f.remote, 'rev-parse', 'main'), f.initial);
    assert.equal(readFileSync(join(f.root, 'app.txt'), 'utf8'), 'family customisation\n');
  } finally {
    f.cleanup();
  }
});

await test('dirty checkouts, invalid markers, and detached checkouts cannot publish', () => {
  const f = fixture();
  try {
    writeFileSync(join(f.root, 'app.txt'), 'unsaved work');
    assert.throws(() => updateFork({ ...f, apply: true }), /local changes/);
    f.git(f.root, 'restore', 'app.txt');
    f.git(f.root, 'checkout', '--detach');
    assert.throws(() => updateFork({ ...f, apply: true }), /main branch/);
    f.git(f.root, 'checkout', 'main');
    f.commit(f.root, '.wishlist-upstream.json', '{"protocol":99,"commit":"invalid"}');
    assert.throws(() => updateFork({ ...f, apply: true }), /saved upstream version/);
    assert.equal(f.git(f.remote, 'rev-parse', 'main'), f.initial);
  } finally {
    f.cleanup();
  }
});

await test('a concurrent household push is preserved when publishing is rejected', () => {
  const f = fixture();
  try {
    const source = f.commit(f.root, '.github/local.yml', 'new remote setting\n');
    f.git(f.root, 'push', 'origin', 'main');
    f.git(f.root, 'reset', '--hard', 'HEAD^');
    f.release('next release\n');
    assert.throws(() => updateFork({ ...f, apply: true }), /Git push failed/);
    assert.equal(f.git(f.remote, 'rev-parse', 'main'), source);
  } finally {
    f.cleanup();
  }
});

await test('no-release periods get activity after 28 days and manual runs can retry a build', () => {
  const f = fixture();
  try {
    const now = Date.now();
    assert.equal(updateFork({ ...f, apply: true, now }).status, 'heartbeat');
    const first = f.git(f.root, 'rev-parse', 'HEAD');
    assert.equal(updateFork({ ...f, apply: true, now: now + 1000 }).status, 'current');
    assert.equal(f.git(f.root, 'rev-parse', 'HEAD'), first);
    assert.equal(updateFork({ ...f, apply: true, now: now + 29 * 86400_000 }).status, 'heartbeat');
    assert.equal(
      updateFork({ ...f, apply: true, forceBuild: true, now: now + 30 * 86400_000 }).status,
      'heartbeat'
    );
  } finally {
    f.cleanup();
  }
});

await test('build verification requires the official Cloudflare check and successful deployment', () => {
  const base = {
    id: 1,
    name: 'Workers Builds: family',
    app: 'cloudflare-workers-and-pages',
    status: 'completed',
    conclusion: 'success'
  };
  assert.equal(cloudflareBuildState([]), 'missing');
  assert.equal(cloudflareBuildState([{ ...base, app: 'other-app' }]), 'missing');
  assert.equal(cloudflareBuildState([base]), 'success');
  assert.equal(
    cloudflareBuildState([{ ...base, status: 'in_progress', conclusion: null }]),
    'pending'
  );
  assert.equal(cloudflareBuildState([{ ...base, conclusion: 'failure' }]), 'failed');
  assert.equal(cloudflareBuildState([{ ...base, conclusion: 'cancelled' }]), 'failed');
  assert.equal(
    cloudflareBuildState([
      { ...base, conclusion: 'failure' },
      { ...base, id: 2 }
    ]),
    'success'
  );
  assert.equal(
    cloudflareBuildState([
      base,
      { ...base, name: 'Workers Builds: another-worker', conclusion: 'failure' }
    ]),
    'failed'
  );
});
