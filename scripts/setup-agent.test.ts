import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { householdArguments } from './setup-household.ts';
import { accessArguments } from './setup-access-application.ts';

const account = 'a'.repeat(32);
const args = ['--account-id', account, '--worker-name', 'family-test', '--yes'];
await test('household inputs require target, explicit approval and a valid reuse UUID', () => {
  assert.equal(householdArguments([]), null);
  assert.deepEqual(householdArguments(args), {
    accountId: account,
    workerName: 'family-test',
    databaseName: 'family-test',
    reuseDatabaseId: null
  });
  for (const invalid of [
    ['--yes'],
    args.slice(0, -1),
    [...args, '--force'],
    [...args, '--reuse-database-id', 'invalid'],
    [...args, 'unexpected']
  ])
    assert.throws(() => householdArguments(invalid));
  const id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  assert.equal(householdArguments([...args, '--reuse-database-id', id])?.reuseDatabaseId, id);
});
await test('Access inputs require explicit email, hostname and approval', () => {
  assert.equal(accessArguments([]), null);
  const input = [
    '--organiser-email',
    'Organiser@example.invalid',
    '--hostname',
    'family-test.example.workers.dev'
  ];
  assert.deepEqual(accessArguments([...input, '--yes']), {
    organiserEmail: 'organiser@example.invalid',
    hostname: 'family-test.example.workers.dev'
  });
  for (const invalid of [
    input,
    ['--yes'],
    [...input, '--yes', '--force'],
    [...input, '--yes', 'unexpected']
  ])
    assert.throws(() => accessArguments(invalid));
});
for (const script of ['setup-household.ts', 'setup-access-application.ts']) {
  await test(`${script} supports help and rejects incomplete input without a terminal or installation`, () => {
    const cwd = mkdtempSync(join(tmpdir(), 'wishlist-agent-cli-'));
    try {
      const entry = resolve('scripts', script);
      const help = spawnSync(process.execPath, [entry, '--help'], {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 10000
      });
      assert.equal(help.status, 0, help.stderr);
      assert.match(help.stdout, /--yes/);
      const invalid = spawnSync(process.execPath, [entry, '--yes'], {
        cwd,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 10000
      });
      assert.equal(invalid.status, 1, invalid.stderr);
      assert.match(invalid.stderr, /Non-interactive setup requires/);
    } finally {
      rmSync(cwd, { recursive: true, force: true });
    }
  });
}
