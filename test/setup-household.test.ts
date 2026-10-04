import { describe, expect, it, vi } from 'vitest';
import { prepareHousehold } from '../scripts/setup-household';
import type { WranglerRunner } from '../scripts/check-setup';
import { installationCfArgs } from '../scripts/installation-cf';

const input = { accountId: 'a'.repeat(32), workerName: 'family-test', databaseName: 'family-test' };
const database = { uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: input.databaseName };
const existing = { ...input, databaseId: database.uuid };
function fixture(initial = false) {
  let created = initial;
  const calls: string[][] = [];
  const runner: WranglerRunner = (args) => {
    calls.push(args);
    if (args[0] === 'whoami')
      return {
        status: 0,
        stderr: '',
        stdout: JSON.stringify({ accounts: [{ id: input.accountId }] })
      };
    if (args[1] === 'list')
      return { status: 0, stderr: '', stdout: JSON.stringify(created ? [database] : []) };
    if (args[1] === 'create') {
      created = true;
      return { status: 0, stderr: '', stdout: 'human-readable output' };
    }
    throw new Error('unexpected command');
  };
  return { runner, calls };
}

describe('household configuration', () => {
  it('creates one approved database, reads its ID back and prevents edits to shared config', async () => {
    const { runner, calls } = fixture();
    const confirm = vi.fn().mockResolvedValue(true);
    await expect(prepareHousehold(input, runner, confirm)).resolves.toEqual(existing);
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining(input.accountId));
    expect(calls.filter((args) => args[1] === 'create')).toEqual([
      ['d1', 'create', input.databaseName, '--update-config=false']
    ]);
    expect(calls.filter((args) => args[1] === 'list')).toHaveLength(2);
  });
  it('explicitly confirms reuse of a database discovered after an interrupted create', async () => {
    const { runner, calls } = fixture(true);
    const confirm = vi.fn().mockResolvedValue(true);
    await expect(prepareHousehold(input, runner, confirm)).resolves.toEqual(existing);
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining(database.uuid));
    expect(calls.some((args) => args[1] === 'create')).toBe(false);
  });
  it('verifies a saved installation without asking to create or reuse anything', async () => {
    const { runner, calls } = fixture(true);
    const confirm = vi.fn();
    await expect(prepareHousehold(input, runner, confirm, existing)).resolves.toEqual(existing);
    expect(confirm).not.toHaveBeenCalled();
    expect(calls.some((args) => args[1] === 'create')).toBe(false);
  });
  it('stops when the saved database disappeared', async () => {
    const { runner, calls } = fixture();
    await expect(prepareHousehold(input, runner, vi.fn(), existing)).rejects.toThrow(
      'no replacement was created'
    );
    expect(calls.some((args) => args[1] === 'create')).toBe(false);
  });
  it('does not create a database when confirmation is declined', async () => {
    const { runner, calls } = fixture();
    await expect(prepareHousehold(input, runner, () => Promise.resolve(false))).rejects.toThrow(
      'Stopped'
    );
    expect(calls.some((args) => args[1] === 'create')).toBe(false);
  });
  it('rejects another account before database discovery', async () => {
    const runner = vi.fn().mockReturnValue({
      status: 0,
      stdout: JSON.stringify({ accounts: [{ id: 'c'.repeat(32) }] }),
      stderr: ''
    });
    await expect(prepareHousehold(input, runner, vi.fn())).rejects.toThrow('not signed in');
    expect(runner).toHaveBeenCalledOnce();
  });
  it('rejects a settings mismatch before any Cloudflare command', async () => {
    const runner = vi.fn();
    await expect(
      prepareHousehold(input, runner, vi.fn(), { ...existing, workerName: 'another-family' })
    ).rejects.toThrow('separate checkout');
    expect(runner).not.toHaveBeenCalled();
  });
});

describe('installation-scoped cf commands', () => {
  it('accepts resource commands without switching account or migrating the project', () => {
    expect(installationCfArgs(['zero-trust', 'organization', 'get'])).toEqual([
      'zero-trust',
      'organization',
      'get'
    ]);
  });
  it.each(
    [
      ['deploy'],
      ['migrate'],
      ['user', 'tokens', 'create'],
      ['zero-trust', 'access', '--zone=another-zone'],
      ['zero-trust', 'organization', 'get', '-qz', 'another-zone'],
      ['zero-trust', 'organization', 'get', '-zother-zone'],
      ['d1', 'list', '-qm', 'another-mode'],
      ['d1', 'list', '--profile', 'another'],
      ['d1', 'list', '--local']
    ].map((args) => ({ args }))
  )('rejects project migrations and scope overrides', ({ args }) => {
    expect(() => installationCfArgs(args)).toThrow();
  });
});

describe('agent household setup', () => {
  it('creates without a terminal but never automatically adopts a discovered database', async () => {
    const fresh = fixture();
    await expect(
      prepareHousehold(input, fresh.runner, () => Promise.resolve(true), null, null)
    ).resolves.toEqual(existing);
    const found = fixture(true);
    await expect(
      prepareHousehold(input, found.runner, () => Promise.resolve(true), null, null)
    ).rejects.toThrow('--reuse-database-id');
    expect(found.calls.some((args) => args[1] === 'create')).toBe(false);
  });
  it('reuses only an explicitly selected live UUID, or a verified saved installation', async () => {
    const found = fixture(true);
    await expect(
      prepareHousehold(input, found.runner, () => Promise.resolve(true), null, database.uuid)
    ).resolves.toEqual(existing);
    await expect(
      prepareHousehold(input, found.runner, () => Promise.resolve(true), existing, null)
    ).resolves.toEqual(existing);
    await expect(
      prepareHousehold(
        input,
        found.runner,
        () => Promise.resolve(true),
        existing,
        'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
      )
    ).rejects.toThrow('explicitly selected');
    const absent = fixture();
    await expect(
      prepareHousehold(input, absent.runner, () => Promise.resolve(true), null, database.uuid)
    ).rejects.toThrow('No replacement');
    expect(absent.calls.some((args) => args[1] === 'create')).toBe(false);
  });
});
