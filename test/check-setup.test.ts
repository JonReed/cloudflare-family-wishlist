import { describe, expect, it, vi } from 'vitest';

import { checkSetup, parseSetupConfiguration, type WranglerRunner } from '../scripts/check-setup';

const configuration = {
  accountId: '0123456789abcdef0123456789abcdef',
  databaseId: 'ec081efb-f134-49b4-887a-558ec776fe9e',
  databaseName: 'family-wishlist',
  workerName: 'family-wishlist'
};

const requiredBindings = [
  'ACCESS_AUD',
  'ACCESS_MANAGEMENT_ACCOUNT_ID',
  'ACCESS_MANAGEMENT_API_TOKEN',
  'ACCESS_MANAGEMENT_APPLICATION_ID',
  'ACCESS_TEAM_DOMAIN',
  'AI',
  'BROWSER',
  'DB',
  'INITIAL_ORGANISER_EMAIL'
];

function runner(overrides: Record<string, string> = {}): WranglerRunner {
  return (args) => {
    const command = args.join(' ');
    const outputs: Record<string, string> = {
      'types --check': '',
      'whoami --json': JSON.stringify({ accounts: [{ id: configuration.accountId }] }),
      'd1 info DB --json': JSON.stringify({
        uuid: configuration.databaseId,
        name: configuration.databaseName
      }),
      'd1 migrations list DB --remote': '✅ No migrations to apply!',
      'versions list --json': JSON.stringify([{ id: 'version-one', number: 1 }]),
      'versions view version-one --json': JSON.stringify({
        resources: { bindings: requiredBindings.map((name) => ({ name, type: 'test' })) }
      }),
      ...overrides
    };
    return {
      status: command in outputs ? 0 : 1,
      stdout: outputs[command] ?? '',
      stderr: command in outputs ? '' : 'unexpected command'
    };
  };
}

describe('setup checker', () => {
  it('parses comments and trailing commas from wrangler JSONC', () => {
    expect(
      parseSetupConfiguration(`{
        // deployment identifiers
        "name": "family-wishlist",
        "account_id": "${configuration.accountId}",
        "ai": { "binding": "AI", },
        "browser": { "binding": "BROWSER" },
        "d1_databases": [{
          "binding": "DB",
          "database_name": "family-wishlist",
          "database_id": "${configuration.databaseId}",
        }],
      }`)
    ).toEqual(configuration);
  });

  it('checks the account, D1 migrations and deployed bindings without Access credentials', async () => {
    await expect(checkSetup(configuration, runner(), {})).resolves.toEqual(
      expect.arrayContaining([
        expect.stringContaining('no pending migrations'),
        expect.stringContaining('Deep Access API checks were skipped')
      ])
    );
  });

  it('runs deep read-only Access checks when every setup variable is present', async () => {
    const session = vi.fn().mockResolvedValue({ applicationName: 'Family Wishlist' });
    const sharing = vi.fn().mockResolvedValue({ hostname: 'wishlist.example.com' });
    const env = {
      ACCESS_MANAGEMENT_ACCOUNT_ID: configuration.accountId,
      ACCESS_MANAGEMENT_APPLICATION_ID: '870fa30d-1350-4d8c-92e6-7f005f6f878f',
      ACCESS_MANAGEMENT_API_TOKEN: 'secret-test-token',
      WISHLIST_PUBLIC_HOSTNAMES: 'wishlist.example.com,wishlist.example.com'
    };

    await expect(checkSetup(configuration, runner(), env, { session, sharing })).resolves.toContain(
      'The 30-day Access session and narrow public-sharing applications are exact.'
    );
    expect(session).toHaveBeenCalledOnce();
    expect(sharing).toHaveBeenCalledOnce();
  });

  it('fails when a required deployed binding is missing', async () => {
    const bindings = requiredBindings.filter((name) => name !== 'INITIAL_ORGANISER_EMAIL');
    await expect(
      checkSetup(
        configuration,
        runner({
          'versions view version-one --json': JSON.stringify({
            resources: { bindings: bindings.map((name) => ({ name })) }
          })
        }),
        {}
      )
    ).rejects.toThrow('INITIAL_ORGANISER_EMAIL');
  });

  it('fails when only some deep-check environment variables are supplied', async () => {
    await expect(
      checkSetup(configuration, runner(), {
        ACCESS_MANAGEMENT_API_TOKEN: 'secret-test-token'
      })
    ).rejects.toThrow('ACCESS_MANAGEMENT_ACCOUNT_ID');
  });
});
