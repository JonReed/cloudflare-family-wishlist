import { describe, expect, it, vi } from 'vitest';

import {
  checkAccessSession,
  configureAccessSession,
  readAccessSessionConfiguration
} from '../scripts/configure-access-session';

const configuration = {
  accountId: '0123456789abcdef0123456789abcdef',
  applicationId: '870fa30d-1350-4d8c-92e6-7f005f6f878f',
  apiToken: 'test-token-that-must-not-appear-in-errors'
};

const policyIds = [crypto.randomUUID(), crypto.randomUUID()];

function accessApplication(sessionDuration = '24h') {
  return {
    id: configuration.applicationId,
    aud: 'audience-tag-that-must-not-change',
    type: 'self_hosted',
    name: 'Family Wishlist',
    domain: '',
    destinations: [{ type: 'worker', worker_id: 'cloudflare-family-wishlist' }],
    policies: [
      { id: policyIds[0], precedence: 1, name: 'Family members' },
      { id: policyIds[1], precedence: 2, name: 'Another member' }
    ],
    allowed_idps: ['onetimepin'],
    auto_redirect_to_identity: true,
    allow_authenticate_via_warp: false,
    http_only_cookie_attribute: true,
    same_site_cookie_attribute: 'lax',
    enable_binding_cookie: false,
    session_duration: sessionDuration
  };
}

describe('Access session setup', () => {
  it('reads the existing Access management environment without exposing the token', () => {
    expect(
      readAccessSessionConfiguration({
        ACCESS_MANAGEMENT_ACCOUNT_ID: configuration.accountId,
        ACCESS_MANAGEMENT_APPLICATION_ID: configuration.applicationId,
        ACCESS_MANAGEMENT_API_TOKEN: configuration.apiToken
      })
    ).toEqual(configuration);
  });

  it.each([
    {},
    { ...configuration, ACCESS_MANAGEMENT_ACCOUNT_ID: 'wrong' },
    { ...configuration, ACCESS_MANAGEMENT_APPLICATION_ID: 'wrong' },
    { ...configuration, ACCESS_MANAGEMENT_API_TOKEN: '' }
  ])('rejects missing or malformed setup configuration', (env) => {
    expect(() => readAccessSessionConfiguration(env)).toThrow();
  });

  it('does nothing when the application already has 30-day sessions', async () => {
    const client = {
      get: vi.fn().mockResolvedValue(accessApplication('720h')),
      update: vi.fn()
    };

    await expect(configureAccessSession(configuration, client)).resolves.toEqual({
      applicationName: 'Family Wishlist',
      changed: false,
      sessionDuration: '720h'
    });
    expect(client.get).toHaveBeenCalledOnce();
    expect(client.update).not.toHaveBeenCalled();
  });

  it('checks the 30-day session without attempting an update', async () => {
    const client = { get: vi.fn().mockResolvedValue(accessApplication('720h')) };

    await expect(checkAccessSession(configuration, client)).resolves.toEqual({
      applicationName: 'Family Wishlist',
      sessionDuration: '720h'
    });
    expect(client.get).toHaveBeenCalledOnce();
  });

  it('fails the read-only check when the session duration has drifted', async () => {
    const client = { get: vi.fn().mockResolvedValue(accessApplication('24h')) };

    await expect(checkAccessSession(configuration, client)).rejects.toThrow('720h');
    expect(client.get).toHaveBeenCalledOnce();
  });

  it('sets 30-day sessions while preserving destinations, authentication, cookies and policies', async () => {
    const before = accessApplication();
    const after = accessApplication('720h');
    const client = {
      get: vi.fn().mockResolvedValueOnce(before).mockResolvedValueOnce(after),
      update: vi.fn().mockResolvedValue(after)
    };

    await expect(configureAccessSession(configuration, client)).resolves.toEqual({
      applicationName: 'Family Wishlist',
      changed: true,
      sessionDuration: '720h'
    });

    expect(client.update).toHaveBeenCalledWith(
      configuration.applicationId,
      configuration.accountId,
      expect.objectContaining({
        type: 'self_hosted',
        domain: '',
        destinations: before.destinations,
        allowed_idps: ['onetimepin'],
        auto_redirect_to_identity: true,
        http_only_cookie_attribute: true,
        same_site_cookie_attribute: 'lax',
        session_duration: '720h',
        policies: [
          { id: policyIds[0], precedence: 1 },
          { id: policyIds[1], precedence: 2 }
        ]
      })
    );
    expect(client.get).toHaveBeenCalledTimes(2);
  });

  it.each([undefined, null])('supports Worker applications with domain %s', async (domain) => {
    const before = {
      ...accessApplication(),
      domain,
      destinations: [{ type: 'worker', worker_id: '0123456789abcdef0123456789abcdef' }]
    };
    const after = { ...before, session_duration: '720h' };
    const client = {
      get: vi.fn().mockResolvedValueOnce(before).mockResolvedValueOnce(after),
      update: vi.fn().mockResolvedValue(after)
    };
    await expect(configureAccessSession(configuration, client)).resolves.toMatchObject({
      changed: true
    });
    expect(client.update).toHaveBeenCalledWith(
      configuration.applicationId,
      configuration.accountId,
      expect.objectContaining({ destinations: before.destinations, session_duration: '720h' })
    );
    await expect(
      checkAccessSession(configuration, { get: vi.fn().mockResolvedValue(after) })
    ).resolves.toMatchObject({ sessionDuration: '720h' });
  });

  it.each([
    { ...accessApplication(), domain: 42 },
    {
      ...accessApplication(),
      domain: undefined,
      destinations: [{ type: 'worker', worker_id: '' }]
    },
    {
      ...accessApplication(),
      domain: undefined,
      destinations: [{ type: 'public', uri: 'example.com' }]
    },
    { ...accessApplication(), id: crypto.randomUUID() },
    { ...accessApplication(), type: 'saas' },
    { ...accessApplication(), destinations: [] },
    { ...accessApplication(), policies: [] },
    { ...accessApplication(), aud: '' }
  ])('refuses to update an unexpected or unreadable application', async (application) => {
    const client = {
      get: vi.fn().mockResolvedValue(application),
      update: vi.fn()
    };

    await expect(configureAccessSession(configuration, client)).rejects.toThrow();
    expect(client.update).not.toHaveBeenCalled();
  });

  it('fails verification if Cloudflare changes another security-critical setting', async () => {
    const client = {
      get: vi
        .fn()
        .mockResolvedValueOnce(accessApplication())
        .mockResolvedValueOnce({ ...accessApplication('720h'), allowed_idps: [] }),
      update: vi.fn().mockResolvedValue(accessApplication('720h'))
    };

    await expect(configureAccessSession(configuration, client)).rejects.toThrow('allowed_idps');
  });
});
