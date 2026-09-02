import { describe, expect, it, vi } from 'vitest';

import {
  checkPublicSharingAccess,
  ensurePublicSharingAccess,
  PublicSharingAccessError,
  type PublicSharingAccessResult
} from '../app/lib/cloudflare/access-public-sharing';
import { configureAccessSharing } from '../scripts/configure-access-sharing';

const env = {
  ACCESS_MANAGEMENT_ACCOUNT_ID: '0123456789abcdef0123456789abcdef',
  ACCESS_MANAGEMENT_APPLICATION_ID: '870fa30d-1350-4d8c-92e6-7f005f6f878f',
  ACCESS_MANAGEMENT_API_TOKEN: 'test-token-that-must-not-appear-in-errors'
};
const applicationId = '63cc370f-76d8-4a13-9d0d-b0442c732140';
const hostname = 'wishlist.example.com';
const name = `Family Wishlist public sharing — ${hostname}`;

function application(overrides: Record<string, unknown> = {}) {
  return {
    id: applicationId,
    type: 'self_hosted',
    name,
    domain: `${hostname}/shared/*`,
    destinations: [
      { type: 'public', uri: `${hostname}/shared/*` },
      { type: 'public', uri: `${hostname}/shared-assets/*` },
      { type: 'public', uri: `${hostname}/favicon.svg` }
    ],
    policies: [
      {
        id: crypto.randomUUID(),
        name: 'Public viewing links',
        decision: 'bypass',
        precedence: 1,
        include: [{ everyone: {} }]
      }
    ],
    ...overrides
  };
}

function envelope(result: unknown, status = 200) {
  return new Response(JSON.stringify({ success: status < 400, result }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function applicationList(applications: unknown[]) {
  return new Response(
    JSON.stringify({
      success: true,
      result: applications,
      result_info: {
        page: 1,
        count: applications.length,
        total_count: applications.length,
        total_pages: 1
      }
    }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}

describe('public sharing Access setup', () => {
  it('creates only the three public destinations with an Everyone Bypass policy', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(applicationList([]))
      .mockResolvedValueOnce(envelope(application()));

    await expect(ensurePublicSharingAccess(env, hostname, fetcher)).resolves.toEqual({
      applicationId,
      applicationName: name,
      created: true,
      hostname
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    const [url, init] = fetcher.mock.calls[1];
    expect(url).toBe(
      `https://api.cloudflare.com/client/v4/accounts/${env.ACCESS_MANAGEMENT_ACCOUNT_ID}/access/apps`
    );
    expect(init?.method).toBe('POST');
    expect(typeof init?.body).toBe('string');
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : null;
    expect(body).toEqual({
      type: 'self_hosted',
      name,
      domain: `${hostname}/shared/*`,
      destinations: [
        { type: 'public', uri: `${hostname}/shared/*` },
        { type: 'public', uri: `${hostname}/shared-assets/*` },
        { type: 'public', uri: `${hostname}/favicon.svg` }
      ],
      app_launcher_visible: false,
      policies: [
        {
          name: 'Public viewing links',
          decision: 'bypass',
          precedence: 1,
          include: [{ everyone: {} }]
        }
      ]
    });
  });

  it('is idempotent when the exact managed application already exists', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(applicationList([application()]));

    await expect(ensurePublicSharingAccess(env, hostname, fetcher)).resolves.toMatchObject({
      applicationId,
      created: false
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('checks an exact managed application without creating anything', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(applicationList([application()]));

    await expect(checkPublicSharingAccess(env, hostname, fetcher)).resolves.toEqual({
      applicationId,
      applicationName: name,
      created: false,
      hostname
    });
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0][1]?.method).toBe('GET');
  });

  it('fails the read-only check when the managed application is missing', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(applicationList([]));

    await expect(checkPublicSharingAccess(env, hostname, fetcher)).rejects.toMatchObject({
      code: 'configuration_drift'
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each([
    application({ destinations: [{ type: 'public', uri: `${hostname}/*` }] }),
    application({ policies: [{ decision: 'allow', include: [{ everyone: {} }] }] }),
    application({ policies: [{ decision: 'bypass', include: [{ email: { email: 'x@y.z' } }] }] }),
    application({
      policies: [
        {
          name: 'Public viewing links',
          decision: 'bypass',
          include: [{ everyone: {} }],
          exclude: [{ email: { email: 'x@y.z' } }]
        }
      ]
    }),
    application({
      policies: [
        {
          name: 'A similarly scoped policy',
          decision: 'bypass',
          include: [{ everyone: {} }]
        }
      ]
    })
  ])('fails closed when the managed application has drifted', async (existing) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(applicationList([existing]));
    await expect(ensurePublicSharingAccess(env, hostname, fetcher)).rejects.toMatchObject({
      code: 'configuration_drift'
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('fails closed when duplicate managed applications exist', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        applicationList([application(), application({ id: crypto.randomUUID() })])
      );

    await expect(ensurePublicSharingAccess(env, hostname, fetcher)).rejects.toMatchObject({
      code: 'configuration_drift'
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('accepts an exact application created by a concurrent first request', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(applicationList([]))
      .mockResolvedValueOnce(envelope(null, 409))
      .mockResolvedValueOnce(applicationList([application()]));

    await expect(ensurePublicSharingAccess(env, hostname, fetcher)).resolves.toMatchObject({
      applicationId,
      created: false
    });
  });

  it.each([
    [{}, 'wishlist.example.com', 'not_configured'],
    [env, 'localhost', 'invalid_hostname'],
    [env, 'wishlist.example.com:443', 'invalid_hostname']
  ] as const)('rejects unsafe or incomplete input', async (configuration, requested, code) => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(
      ensurePublicSharingAccess(configuration, requested, fetcher)
    ).rejects.toMatchObject({
      code
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('rejects incomplete pagination rather than overlooking a conflicting application', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          result: [],
          result_info: { page: 1, count: 0, total_count: 1, total_pages: 2 }
        })
      )
    );
    await expect(ensurePublicSharingAccess(env, hostname, fetcher)).rejects.toBeInstanceOf(
      PublicSharingAccessError
    );
  });

  it('configures every unique hostname supplied by setup', async () => {
    const configure = vi.fn<
      (
        environment: NodeJS.ProcessEnv,
        configuredHostname: string
      ) => Promise<PublicSharingAccessResult>
    >((_environment, configuredHostname) =>
      Promise.resolve({
        applicationId,
        applicationName: name,
        created: false,
        hostname: configuredHostname
      })
    );

    await expect(
      configureAccessSharing(
        env,
        ['wishlist.example.com', 'wishlist.example.com', 'other.example.com'],
        configure
      )
    ).resolves.toHaveLength(2);
    expect(configure).toHaveBeenCalledTimes(2);
  });
});
