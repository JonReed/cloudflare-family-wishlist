import { describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:workers';

import {
  checkSetup,
  FIRST_LOGIN_SCHEMA_QUERY,
  parseSetupConfiguration,
  type WranglerRunner
} from '../scripts/check-setup';

const configuration = {
  accountId: '0123456789abcdef0123456789abcdef',
  databaseId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
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

function deployedBindings(names = requiredBindings) {
  return names.map((name) =>
    name === 'DB' ? { name, type: 'd1', id: configuration.databaseId } : { name, type: 'test' }
  );
}

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
      [`d1 execute DB --remote --json --command ${FIRST_LOGIN_SCHEMA_QUERY}`]: JSON.stringify([
        { results: [], success: true }
      ]),
      'deployments status --json': JSON.stringify({
        versions: [{ version_id: 'version-one', percentage: 100 }]
      }),
      'versions view version-one --json': JSON.stringify({
        resources: { bindings: deployedBindings() }
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
  it('compiles the readiness query against the actual migrated D1 schema without returning family rows', async () => {
    const result = await env.DB.prepare(FIRST_LOGIN_SCHEMA_QUERY).all();
    expect(result.success).toBe(true);
    expect(result.results).toEqual([]);
  });
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
            resources: { bindings: deployedBindings(bindings) }
          })
        }),
        {}
      )
    ).rejects.toThrow('INITIAL_ORGANISER_EMAIL');
  });

  it('checks every version receiving traffic during a gradual deployment', async () => {
    const bindings = requiredBindings.filter((name) => name !== 'BROWSER');
    await expect(
      checkSetup(
        configuration,
        runner({
          'deployments status --json': JSON.stringify({
            versions: [
              { version_id: 'version-one', percentage: 90 },
              { version_id: 'version-two', percentage: 10 }
            ]
          }),
          'versions view version-two --json': JSON.stringify({
            resources: { bindings: deployedBindings(bindings) }
          })
        }),
        {}
      )
    ).rejects.toThrow('version-two is missing bindings: BROWSER');
  });

  it('fails when only some deep-check environment variables are supplied', async () => {
    await expect(
      checkSetup(configuration, runner(), {
        ACCESS_MANAGEMENT_API_TOKEN: 'secret-test-token'
      })
    ).rejects.toThrow('ACCESS_MANAGEMENT_ACCOUNT_ID');
  });

  it('checks database readiness before Access settings exist without calling that a finished installation', async () => {
    await expect(
      checkSetup(
        configuration,
        runner({
          'versions view version-one --json': JSON.stringify({
            resources: { bindings: deployedBindings(['DB', 'AI', 'BROWSER']) }
          })
        }),
        {},
        undefined,
        { beforeLogin: true }
      )
    ).resolves.toEqual(
      expect.arrayContaining([
        expect.stringContaining('member, wishlist and invitation schema'),
        expect.stringContaining('Access setup is still required')
      ])
    );
  });

  it.each([
    { name: 'DB', type: 'd1', id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' },
    { name: 'DB', type: 'plain_text', text: configuration.databaseId },
    { name: 'DB', type: 'd1' }
  ])('rejects a deployed database mismatch even when every binding name exists', async (db) => {
    await expect(
      checkSetup(
        configuration,
        runner({
          'versions view version-one --json': JSON.stringify({
            resources: {
              bindings: [...deployedBindings().filter((binding) => binding.name !== 'DB'), db]
            }
          })
        }),
        {}
      )
    ).rejects.toThrow('different D1 database');
  });

  it.each([
    'no such column: first_signed_in_at',
    'no such table: wishlists',
    'no such table: family_invitations'
  ])(
    'stops before deployment inspection when first-login readiness fails with %s',
    async (failure) => {
      const base = runner();
      const calls: string[] = [];
      await expect(
        checkSetup(
          configuration,
          (args) => {
            calls.push(args.join(' '));
            return args[1] === 'execute' ? { status: 1, stdout: '', stderr: failure } : base(args);
          },
          {}
        )
      ).rejects.toThrow(failure);
      expect(calls).not.toContain('deployments status --json');
    }
  );

  it('rejects deep Access checks against another account before calling its API', async () => {
    const session = vi.fn();
    const sharing = vi.fn();
    await expect(
      checkSetup(
        configuration,
        runner(),
        {
          ACCESS_MANAGEMENT_ACCOUNT_ID: 'a'.repeat(32),
          ACCESS_MANAGEMENT_APPLICATION_ID: '870fa30d-1350-4d8c-92e6-7f005f6f878f',
          ACCESS_MANAGEMENT_API_TOKEN: 'secret-test-token',
          WISHLIST_PUBLIC_HOSTNAMES: 'wishlist.example.com'
        },
        { session, sharing }
      )
    ).rejects.toThrow('does not match the installation account');
    expect(session).not.toHaveBeenCalled();
    expect(sharing).not.toHaveBeenCalled();
  });
});
