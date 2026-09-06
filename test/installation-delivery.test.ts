import { describe, expect, it, vi } from 'vitest';
import {
  buildEnvironment,
  installationFingerprint,
  validateBuildReceipt
} from '../scripts/build-installation';
import { compareDeployedCommit } from '../scripts/check-installation-status';
import { validateReleaseVersions } from '../scripts/promote-release';
import { deployProduction } from '../scripts/deploy-production';
import { installationWranglerConfig } from '../scripts/installation-config';

const commit = 'a'.repeat(40);
const settings = {
  accountId: 'b'.repeat(32),
  workerName: 'test-install',
  databaseId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  databaseName: 'test-db'
};
const expected = { commit, repository: 'JonReed/cloudflare-family-wishlist', settings };
const receipt = {
  protocol: 1,
  repository: expected.repository,
  commit,
  directory: '.application-test123',
  installation: installationFingerprint(settings)
};

describe('installation delivery boundaries', () => {
  it('does not pass deployment or repository credentials into public source builds', () => {
    expect(
      buildEnvironment({
        PATH: '/bin',
        CI: 'true',
        CLOUDFLARE_API_TOKEN: 'secret',
        GITHUB_TOKEN: 'secret',
        NODE_OPTIONS: '--import untrusted',
        NPM_TOKEN: 'secret'
      })
    ).toEqual({ PATH: '/bin', CI: 'true' });
  });
  it('accepts only a matching successful build receipt', () => {
    expect(validateBuildReceipt(receipt, expected)).toEqual(receipt);
  });
  it.each([
    null,
    {},
    { ...receipt, commit: 'c'.repeat(40) },
    { ...receipt, protocol: 2 },
    { ...receipt, repository: 'other/repo' },
    { ...receipt, directory: '../application' },
    { ...receipt, directory: '.application-test123\n' },
    { ...receipt, installation: 'wrong-account' }
  ])('rejects stale or unsafe build receipts', (value) => {
    expect(() => validateBuildReceipt(value, expected)).toThrow('matching successful build');
  });
  it('tags the deployed Worker with the upstream SHA after migrations', () => {
    const config = JSON.stringify(
      installationWranglerConfig(
        JSON.stringify({
          ai: { binding: 'AI' },
          browser: { binding: 'BROWSER' },
          d1_databases: [{ binding: 'DB' }]
        }),
        settings
      )
    );
    const runner = vi.fn();
    deployProduction(settings, config, 'source.json', 'built.json', runner, commit);
    expect(runner.mock.calls[0][0]).toContain('migrations');
    expect(runner.mock.calls[1][0]).toEqual([
      'deploy',
      '--config',
      'built.json',
      '--keep-vars',
      '--tag',
      commit
    ]);
    runner.mockClear();
    expect(() =>
      deployProduction(settings, config, 'source.json', 'built.json', runner, 'main')
    ).toThrow('full SHA');
    expect(runner).not.toHaveBeenCalled();
    expect(() =>
      deployProduction(settings, config, 'source.json', 'built.json', runner, commit + '\n')
    ).toThrow('full SHA');
    expect(runner).not.toHaveBeenCalled();
  });
});

describe('desired versus deployed versions', () => {
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const version = { version_id: id, percentage: 100 };
  it('requires the desired SHA on all traffic-bearing versions', () => {
    expect(
      compareDeployedCommit(commit, { versions: [version] }, () => ({
        annotations: { 'workers/tag': commit }
      })).current
    ).toBe(true);
    expect(
      compareDeployedCommit(
        commit,
        {
          versions: [
            { ...version, percentage: 50 },
            { version_id: other, percentage: 50 }
          ]
        },
        (key) => ({ annotations: { 'workers/tag': key === id ? commit : 'b'.repeat(40) } })
      ).current
    ).toBe(false);
  });
  it('reports untagged older deployments as unverified rather than current', () => {
    expect(compareDeployedCommit(commit, { versions: [version] }, () => ({}))).toMatchObject({
      current: false,
      versions: [{ commit: null }]
    });
  });
  it.each([
    {},
    { versions: [] },
    { versions: [{ ...version, version_id: '-'.repeat(36) }] },
    { versions: [{ ...version, version_id: id + '\n' }] },
    { versions: [{ ...version, percentage: 20 }] },
    { versions: [{ ...version, percentage: -1 }] }
  ])('rejects unreadable or incomplete traffic data', (deployment) => {
    expect(() => compareDeployedCommit(commit, deployment, () => ({}))).toThrow();
  });
  it('rejects malformed expected SHAs and does not accept malformed version tags', () => {
    expect(() =>
      compareDeployedCommit(commit + '\n', { versions: [version] }, () => ({}))
    ).toThrow();
    expect(
      compareDeployedCommit(commit, { versions: [version] }, () => ({
        annotations: { 'workers/tag': commit + '\n' }
      })).current
    ).toBe(false);
  });
});

describe('release version consistency', () => {
  const target = { tag: 'v1.0.0', sha: commit };
  const manifest = JSON.stringify({ version: '1.0.0' });
  const lock = JSON.stringify({ version: '1.0.0', packages: { '': { version: '1.0.0' } } });
  it('accepts the exact package and lockfile version', () => {
    expect(() => validateReleaseVersions(target, manifest, lock)).not.toThrow();
  });
  it('blocks publishing a differently numbered package', () => {
    expect(() =>
      validateReleaseVersions(target, JSON.stringify({ version: '0.1.0' }), lock)
    ).toThrow('must agree');
    expect(() => validateReleaseVersions(target, manifest, '{}')).toThrow('must agree');
  });
});
