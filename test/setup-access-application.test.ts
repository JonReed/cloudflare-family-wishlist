import { describe, expect, it, vi } from 'vitest';
import {
  accessApplicationBody,
  cfResourceEnvironment,
  parseCfOutput,
  prepareAccessApplication,
  type CfRunner
} from '../scripts/setup-access-application';

const installation = {
  accountId: 'a'.repeat(32),
  workerName: 'family-test',
  databaseName: 'family-test',
  databaseId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
};
const input = {
  organiserEmail: 'organiser@example.invalid',
  hostname: 'family-test.example.workers.dev'
};
const setup = {
  ...input,
  workerId: 'c'.repeat(32),
  otpId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
  teamDomain: 'family-test.cloudflareaccess.com',
  applicationId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
};
const application = {
  ...accessApplicationBody(setup),
  id: setup.applicationId,
  aud: 'f'.repeat(64)
};
function fixture(
  options: {
    existing?: boolean;
    provider?: boolean;
    providers?: unknown;
    application?: unknown;
    workers?: unknown;
    organisation?: unknown;
  } = {}
) {
  const calls: string[][] = [];
  const runner: CfRunner = (args) => {
    calls.push(args);
    const command = args
      .slice(0, args.indexOf('--page') === -1 ? args.length : args.indexOf('--page'))
      .join(' ');
    if (args.includes('--page') && args[args.indexOf('--page') + 1] !== '1') return [];
    if (command === 'zero-trust organization get')
      return options.organisation ?? { auth_domain: setup.teamDomain };
    if (command.startsWith('workers scripts search'))
      return options.workers ?? [{ id: setup.workerId, script_name: installation.workerName }];
    if (command === 'zero-trust identity-providers list')
      return (
        options.providers ?? (options.provider ? [{ id: setup.otpId, type: 'onetimepin' }] : [])
      );
    if (command.startsWith('zero-trust identity-providers create'))
      return { id: setup.otpId, type: 'onetimepin' };
    if (command === 'zero-trust access applications list')
      return options.existing ? [options.application ?? application] : [];
    if (command.startsWith('zero-trust access applications create')) return application;
    if (command.startsWith('zero-trust access applications get'))
      return options.application ?? application;
    throw new Error(`unexpected command ${command}`);
  };
  return { runner, calls };
}

describe('Access application CLI setup', () => {
  it('preserves resource help as readable text while still rejecting unreadable resource JSON', () => {
    const help = 'cf zero-trust access applications create\nOptions\n  --body';
    expect(parseCfOutput(help, ['zero-trust', 'access', 'applications', 'create', '--help'])).toBe(
      help
    );
    expect(parseCfOutput(help, ['zero-trust', 'access', 'applications', 'create', '-qh'])).toBe(
      help
    );
    expect(() => parseCfOutput(help, ['zero-trust', 'access', 'applications', 'list'])).toThrow(
      'unreadable JSON'
    );
    expect(
      parseCfOutput('[{"id":"app"}]', ['zero-trust', 'access', 'applications', 'list'])
    ).toEqual([{ id: 'app' }]);
  });
  it('selects the household account and prevents inherited zone settings from redirecting Access requests', () => {
    expect(
      cfResourceEnvironment(installation.accountId, {
        CLOUDFLARE_ACCOUNT_ID: 'b'.repeat(32),
        CLOUDFLARE_ZONE_ID: 'c'.repeat(32),
        CLOUDFLARE_API_TOKEN: 'test-credential',
        PATH: '/tools'
      })
    ).toEqual({
      CLOUDFLARE_ACCOUNT_ID: installation.accountId,
      CLOUDFLARE_ZONE_ID: '',
      CLOUDFLARE_API_TOKEN: 'test-credential',
      PATH: '/tools'
    });
  });
  it('creates only OTP and exact-email protection for one Worker and verifies the readback', async () => {
    const { runner, calls } = fixture();
    await expect(
      prepareAccessApplication(installation, input, runner, () => Promise.resolve(true))
    ).resolves.toEqual(setup);
    const create = calls.find(
      (args) => args.slice(0, 4).join(' ') === 'zero-trust access applications create'
    );
    expect(JSON.parse(create![5])).toMatchObject({
      destinations: [{ type: 'worker', worker_id: setup.workerId }],
      policies: [{ decision: 'allow', include: [{ email: { email: input.organiserEmail } }] }]
    });
    expect(calls.at(-1)?.slice(0, 4)).toEqual(['zero-trust', 'access', 'applications', 'get']);
  });
  it('reuses a matching app and provider without remote writes', async () => {
    const { runner, calls } = fixture({ existing: true, provider: true });
    await expect(
      prepareAccessApplication(installation, input, runner, () => Promise.resolve(true), setup)
    ).resolves.toEqual(setup);
    expect(calls.some((args) => args.includes('create'))).toBe(false);
  });
  it('makes no changes when the owner declines', async () => {
    const { runner, calls } = fixture();
    await expect(
      prepareAccessApplication(installation, input, runner, () => Promise.resolve(false))
    ).rejects.toThrow('Stopped');
    expect(calls.some((args) => args.includes('create'))).toBe(false);
  });
  it('reuses the saved OTP provider even when the account contains another one', async () => {
    const { runner, calls } = fixture({
      existing: true,
      providers: [
        { id: setup.otpId, type: 'onetimepin' },
        { id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', type: 'onetimepin' }
      ]
    });
    await expect(
      prepareAccessApplication(installation, input, runner, () => Promise.resolve(true), setup)
    ).resolves.toEqual(setup);
    expect(calls.some((args) => args.includes('create'))).toBe(false);
  });
  it('does not create replacements for changed saved state', async () => {
    const { runner, calls } = fixture({ provider: true });
    await expect(
      prepareAccessApplication(installation, input, runner, vi.fn(), setup)
    ).rejects.toThrow('no replacement was created');
    expect(calls.some((args) => args.includes('create'))).toBe(false);
  });
  it('rejects another Worker returned by partial-name search', async () => {
    const { runner, calls } = fixture({
      workers: [{ id: setup.workerId, script_name: 'family-test-other' }]
    });
    await expect(prepareAccessApplication(installation, input, runner, vi.fn())).rejects.toThrow(
      'exactly one deployed Worker'
    );
    expect(calls.some((args) => args.includes('create'))).toBe(false);
  });
  it('stops when Zero Trust has not been onboarded', async () => {
    const { runner, calls } = fixture({ organisation: {} });
    await expect(prepareAccessApplication(installation, input, runner, vi.fn())).rejects.toThrow(
      'Zero Trust Free'
    );
    expect(calls.some((args) => args.includes('create'))).toBe(false);
  });
  it('rejects previews-only protection without changing the existing app', async () => {
    const { runner, calls } = fixture({
      existing: true,
      provider: true,
      application: {
        ...application,
        destinations: [{ type: 'preview_worker', worker_id: setup.workerId }]
      }
    });
    await expect(
      prepareAccessApplication(installation, input, runner, () => Promise.resolve(true))
    ).rejects.toThrow('all traffic');
    expect(calls.some((args) => args.includes('create') || args.includes('update'))).toBe(false);
  });
  it('reads all pages before deciding there is no matching app', async () => {
    const { runner, calls } = fixture({ provider: true });
    const paginated: CfRunner = (args) => {
      if (args.slice(0, 4).join(' ') === 'zero-trust access applications list') {
        const page = args[args.indexOf('--page') + 1];
        if (page === '1') return Array.from({ length: 100 }, (_, i) => ({ id: `unrelated-${i}` }));
        if (page === '2') return [application];
      }
      return runner(args);
    };
    await expect(
      prepareAccessApplication(installation, input, paginated, () => Promise.resolve(true))
    ).resolves.toEqual(setup);
    expect(calls.some((args) => args.includes('create'))).toBe(false);
  });
  it.each([input.hostname, `${input.hostname}/*`])(
    'stops on existing hostname protection for %s without creating a duplicate',
    async (uri) => {
      const { runner, calls } = fixture({
        existing: true,
        provider: true,
        application: {
          ...application,
          name: 'Existing protection',
          destinations: [{ type: 'public', uri }]
        }
      });
      await expect(
        prepareAccessApplication(installation, input, runner, () => Promise.resolve(true))
      ).rejects.toThrow('all traffic');
      expect(calls.some((args) => args.includes('create'))).toBe(false);
    }
  );
  it('stops if cf cannot read the attached policies rather than checking account-wide reusable policies', async () => {
    const unreadable = { ...application, policies: undefined };
    const { runner, calls } = fixture({ existing: true, provider: true, application: unreadable });
    await expect(
      prepareAccessApplication(installation, input, runner, () => Promise.resolve(true))
    ).rejects.toThrow('attached Access policies');
    expect(
      calls.some(
        (args) => args.includes('create') || (args.includes('list') && args.includes('policies'))
      )
    ).toBe(false);
  });
});

describe('agent Access setup', () => {
  it.each([
    { ...input, organiserEmail: 'different@example.invalid' },
    { ...input, hostname: 'another.example.workers.dev' }
  ])('rejects changes to a saved identity before any API call', async (changed) => {
    const runner = vi.fn();
    await expect(
      prepareAccessApplication(installation, changed, runner, () => Promise.resolve(true), setup)
    ).rejects.toThrow('differs from the saved');
    expect(runner).not.toHaveBeenCalled();
  });
});
