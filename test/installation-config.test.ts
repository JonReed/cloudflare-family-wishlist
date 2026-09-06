import { describe, expect, it, vi } from 'vitest';

import {
  installationWranglerConfig,
  parseInstallationSettings,
  readInstallationSettings
} from '../scripts/installation-config';
import { installationWranglerArgs } from '../scripts/installation-wrangler';
import { deployProduction } from '../scripts/deploy-production';

const installation = {
  accountId: 'a'.repeat(32),
  workerName: 'test-family',
  databaseId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  databaseName: 'test-family-db'
};
const shared = JSON.stringify({
  name: 'cloudflare-family-wishlist',
  main: './workers/app.ts',
  compatibility_date: '2026-09-01',
  ai: { binding: 'AI' },
  browser: { binding: 'BROWSER' },
  vars: { PRODUCT_AI_ENABLED: 'true' },
  d1_databases: [
    {
      binding: 'DB',
      database_id: 'local-only',
      database_name: 'local',
      migrations_dir: 'migrations'
    }
  ]
});

describe('installation settings', () => {
  it('accepts a complete installation without changing shared bindings or application settings', () => {
    expect(parseInstallationSettings(JSON.stringify(installation))).toEqual(installation);
    const config = installationWranglerConfig(shared, installation);
    expect(config).toMatchObject({
      name: 'test-family',
      account_id: installation.accountId,
      main: './workers/app.ts',
      ai: { binding: 'AI' },
      browser: { binding: 'BROWSER' },
      vars: { PRODUCT_AI_ENABLED: 'true' },
      d1_databases: [
        {
          binding: 'DB',
          database_id: installation.databaseId,
          database_name: 'test-family-db',
          migrations_dir: 'migrations'
        }
      ]
    });
  });

  it.each([
    {},
    { ...installation, accountId: 'not-an-account' },
    { ...installation, databaseId: 'local-only' },
    { ...installation, workerName: '../another-worker' },
    { ...installation, databaseName: '--help' },
    { ...installation, workerName: 'worker\n' },
    { ...installation, vars: { SECRET: 'not-allowed' } },
    { ...installation, main: 'untrusted.js' },
    { ...installation, routes: ['*/*'] }
  ])('rejects malformed or extra installation settings', (value) => {
    expect(() => parseInstallationSettings(JSON.stringify(value))).toThrow();
  });

  it('uses a complete build environment value without reading a local installation', () => {
    expect(
      readInstallationSettings({
        directory: '/no-local-installation',
        env: {
          WISHLIST_INSTALLATION: JSON.stringify(installation)
        },
        required: true
      })
    ).toEqual(installation);
  });

  it('fails on an explicitly empty build value rather than falling back to local settings', () => {
    expect(() => readInstallationSettings({ env: { WISHLIST_INSTALLATION: '' } })).toThrow();
  });

  it('allows configuration-free local development but requires settings for remote operations', () => {
    const options = { directory: '/no-local-installation', env: {} };
    expect(readInstallationSettings(options)).toBeNull();
    expect(() => readInstallationSettings({ ...options, required: true })).toThrow(
      'No installation settings'
    );
  });

  it('does not accept arbitrary config or environment overrides in the installation wrapper', () => {
    expect(installationWranglerArgs(['d1', 'info', 'DB'], 'installation.json')).toEqual([
      'd1',
      'info',
      'DB',
      '--config',
      'installation.json'
    ]);
    for (const flag of ['--config', '--config=other.json', '-c', '--env', '--env=staging', '-e']) {
      expect(() => installationWranglerArgs(['deploy', flag], 'installation.json')).toThrow();
    }
  });
});

describe('installation deployment', () => {
  const built = JSON.stringify(installationWranglerConfig(shared, installation));

  it('migrates the selected installation before deploying its matching build, keeping variables', () => {
    const runner = vi.fn();
    deployProduction(installation, built, 'source.json', 'built.json', runner);
    expect(runner.mock.calls).toEqual([
      [['d1', 'migrations', 'apply', 'DB', '--remote', '--config', 'source.json']],
      [['deploy', '--config', 'built.json', '--keep-vars']]
    ]);
  });

  it('never deploys after a failed migration', () => {
    const runner = vi.fn(() => {
      throw new Error('migration failed');
    });
    expect(() =>
      deployProduction(installation, built, 'source.json', 'built.json', runner)
    ).toThrow('migration failed');
    expect(runner).toHaveBeenCalledTimes(1);
  });

  it.each([
    { ...installation, accountId: 'b'.repeat(32) },
    { ...installation, workerName: 'other-family' },
    { ...installation, databaseId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
    { ...installation, databaseName: 'other-db' }
  ])('rejects a build for another installation before any remote command', (other) => {
    const runner = vi.fn();
    expect(() => deployProduction(other, built, 'source.json', 'built.json', runner)).toThrow(
      'Rebuild'
    );
    expect(runner).not.toHaveBeenCalled();
  });

  it('rejects an unconfigured build before any remote command', () => {
    const runner = vi.fn();
    expect(() =>
      deployProduction(installation, shared, 'source.json', 'built.json', runner)
    ).toThrow();
    expect(runner).not.toHaveBeenCalled();
  });
});
