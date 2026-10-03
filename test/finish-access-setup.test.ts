import { describe, expect, it, vi } from 'vitest';
import {
  finishAccessSetup,
  parseAccessSetup,
  verifyAccessApplication,
  type AccessSetupDependencies
} from '../scripts/finish-access-setup';

const installation = {
  accountId: 'a'.repeat(32),
  workerName: 'test-family',
  databaseName: 'test-family',
  databaseId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
};
const setup = {
  applicationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  workerId: 'c'.repeat(32),
  teamDomain: 'test-family.cloudflareaccess.com',
  hostname: 'test-family.example.workers.dev',
  organiserEmail: 'organiser@example.invalid',
  otpId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
};
const application = {
  id: setup.applicationId,
  type: 'self_hosted',
  aud: 'e'.repeat(64),
  destinations: [{ type: 'worker', worker_id: setup.workerId }],
  allowed_idps: [setup.otpId],
  http_only_cookie_attribute: true,
  same_site_cookie_attribute: 'lax'
};
const policies = [{ decision: 'allow', include: [{ email: { email: setup.organiserEmail } }] }];

function dependencies() {
  const calls: string[] = [];
  const deps: AccessSetupDependencies = {
    inspect: vi.fn(() => {
      calls.push('inspect');
      return Promise.resolve({ application, policies });
    }),
    session: vi.fn(() => {
      calls.push('session');
      return Promise.resolve({
        applicationName: 'Family',
        changed: false,
        sessionDuration: '720h' as const
      });
    }),
    sharing: vi.fn(() => {
      calls.push('sharing');
      return Promise.resolve([]);
    }),
    installSecrets: vi.fn(() => {
      calls.push('secrets');
    }),
    check: vi.fn((_env, beforeLogin) => {
      calls.push(beforeLogin ? 'database' : 'complete');
      return Promise.resolve(['checked']);
    })
  };
  return { deps, calls };
}

describe('finishing Access setup', () => {
  it('checks readiness and exact Access rules before installing all runtime settings, then checks the result', async () => {
    const { deps, calls } = dependencies();
    await expect(finishAccessSetup(installation, setup, 'private-token', deps)).resolves.toEqual([
      'checked'
    ]);
    expect(calls).toEqual(['database', 'inspect', 'session', 'sharing', 'secrets', 'complete']);
    expect(deps.installSecrets).toHaveBeenCalledWith({
      ACCESS_AUD: application.aud,
      ACCESS_TEAM_DOMAIN: setup.teamDomain,
      INITIAL_ORGANISER_EMAIL: setup.organiserEmail,
      ACCESS_MANAGEMENT_ACCOUNT_ID: installation.accountId,
      ACCESS_MANAGEMENT_APPLICATION_ID: setup.applicationId,
      ACCESS_MANAGEMENT_API_TOKEN: 'private-token'
    });
    expect(deps.check).toHaveBeenLastCalledWith(
      expect.objectContaining({
        ACCESS_MANAGEMENT_ACCOUNT_ID: installation.accountId,
        WISHLIST_PUBLIC_HOSTNAMES: setup.hostname
      }),
      false
    );
  });

  it('makes no remote changes in check mode', async () => {
    const { deps, calls } = dependencies();
    await finishAccessSetup(installation, setup, 'private-token', deps, true);
    expect(calls).toEqual(['database', 'inspect', 'complete']);
    expect(deps.installSecrets).not.toHaveBeenCalled();
    expect(deps.session).not.toHaveBeenCalled();
    expect(deps.sharing).not.toHaveBeenCalled();
  });

  it('makes no Access calls when database readiness fails', async () => {
    const { deps } = dependencies();
    deps.check = vi.fn().mockRejectedValue(new Error('wrong database'));
    await expect(finishAccessSetup(installation, setup, 'private-token', deps)).rejects.toThrow(
      'wrong database'
    );
    expect(deps.inspect).not.toHaveBeenCalled();
    expect(deps.installSecrets).not.toHaveBeenCalled();
  });

  it('does not save runtime settings when narrow sharing configuration fails', async () => {
    const { deps } = dependencies();
    deps.sharing = vi.fn().mockRejectedValue(new Error('configuration drift'));
    await expect(finishAccessSetup(installation, setup, 'private-token', deps)).rejects.toThrow(
      'configuration drift'
    );
    expect(deps.installSecrets).not.toHaveBeenCalled();
    expect(deps.check).toHaveBeenCalledOnce();
  });

  it.each([
    { ...setup, teamDomain: 'https://test-family.cloudflareaccess.com' },
    { ...setup, hostname: 'https://test-family.example.workers.dev/' },
    { ...setup, applicationId: 'not-the-uuid' },
    { ...setup, workerId: 'test-family' },
    { ...setup, organiserEmail: 'organiser@example.invalid\n' },
    { ...setup, otpId: 'onetimepin' },
    { ...setup, token: 'secret' },
    { ...setup, accountId: 'b'.repeat(32) }
  ])(
    'rejects invalid input or attempts to override the installation before any remote work',
    async (value) => {
      expect(() => parseAccessSetup(JSON.stringify(value))).toThrow();
      const { deps } = dependencies();
      await expect(finishAccessSetup(installation, value, 'private-token', deps)).rejects.toThrow();
      expect(deps.check).not.toHaveBeenCalled();
    }
  );

  it.each([
    { ...application, destinations: [{ type: 'preview_worker', worker_id: setup.workerId }] },
    { ...application, destinations: [{ type: 'worker', worker_id: 'f'.repeat(32) }] },
    { ...application, destinations: [{ type: 'all_workers' }] },
    { ...application, allowed_idps: [] },
    { ...application, allowed_idps: [setup.otpId, 'other'] },
    { ...application, http_only_cookie_attribute: false },
    { ...application, same_site_cookie_attribute: 'none' },
    { ...application, aud: 'wrong' },
    { ...application, id: 'different-app' }
  ])('rejects incorrect Access destinations, identity providers and cookies', async (value) => {
    const { deps } = dependencies();
    deps.inspect = vi.fn().mockResolvedValue({ application: value, policies });
    await expect(finishAccessSetup(installation, setup, 'private-token', deps)).rejects.toThrow();
    expect(deps.session).not.toHaveBeenCalled();
    expect(deps.installSecrets).not.toHaveBeenCalled();
  });

  it.each(
    [
      [],
      [{ decision: 'bypass', include: [{ everyone: {} }] }],
      [{ decision: 'allow', include: [{ email_domain: { domain: 'example.invalid' } }] }],
      [{ decision: 'allow', include: [{ email: { email: 'someone-else@example.invalid' } }] }],
      [{ ...policies[0], session_duration: '24h' }],
      [{ ...policies[0], require: [{ everyone: {} }] }]
    ].map((value) => ({ policies: value }))
  )(
    'rejects a broad or incompatible admission policy without rewriting it',
    ({ policies: value }) => {
      expect(() => verifyAccessApplication(application, value, setup)).toThrow();
    }
  );

  it('allows a resumed installation containing other exact family emails', () => {
    expect(
      verifyAccessApplication(
        application,
        [
          ...policies,
          {
            decision: 'allow',
            include: [{ email: { email: 'member@example.invalid' } }],
            exclude: [],
            require: []
          }
        ],
        setup
      )
    ).toBe(application.aud);
  });
});
