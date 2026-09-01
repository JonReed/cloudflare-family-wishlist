import { describe, expect, it, vi } from 'vitest';

import {
  ensureFamilyMemberAccess,
  grantFamilyMemberAccess,
  revokeFamilyAccessSessions,
  revokeFamilyMemberAccess,
  type AccessManagementEnv
} from '../app/lib/cloudflare/access-membership';

const configuration: AccessManagementEnv = {
  ACCESS_MANAGEMENT_ACCOUNT_ID: '0123456789abcdef0123456789abcdef',
  ACCESS_MANAGEMENT_APPLICATION_ID: '870fa30d-1350-4d8c-92e6-7f005f6f878f',
  ACCESS_MANAGEMENT_API_TOKEN: 'test-token-that-must-not-appear-in-errors'
};

describe('Cloudflare Access family membership', () => {
  it.each([
    {},
    { ...configuration, ACCESS_MANAGEMENT_ACCOUNT_ID: 'wrong' },
    { ...configuration, ACCESS_MANAGEMENT_APPLICATION_ID: 'wrong' },
    { ...configuration, ACCESS_MANAGEMENT_API_TOKEN: '' }
  ])('fails closed when management configuration is missing or invalid', async (env) => {
    const fetcher = vi.fn<typeof fetch>();

    await expect(
      grantFamilyMemberAccess(env, crypto.randomUUID(), 'person@example.com', fetcher)
    ).rejects.toMatchObject({ code: 'not_configured' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('creates one exact-email allow policy without exposing the token', async () => {
    const policyId = crypto.randomUUID();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        success: true,
        result: { id: policyId }
      })
    );
    const invitationId = crypto.randomUUID();

    await expect(
      grantFamilyMemberAccess(configuration, invitationId, 'person@example.com', fetcher)
    ).resolves.toBe(policyId);

    expect(fetcher).toHaveBeenCalledOnce();
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe(
      'https://api.cloudflare.com/client/v4/accounts/0123456789abcdef0123456789abcdef/access/apps/870fa30d-1350-4d8c-92e6-7f005f6f878f/policies'
    );
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('Authorization')).toBe(
      'Bearer test-token-that-must-not-appear-in-errors'
    );
    expect(typeof init?.body).toBe('string');
    if (typeof init?.body !== 'string') throw new Error('Expected a JSON request body.');
    expect(JSON.parse(init.body)).toEqual({
      name: `Family Wishlist member ${invitationId.slice(0, 8)}`,
      decision: 'allow',
      include: [{ email: { email: 'person@example.com' } }]
    });
  });

  it.each([
    ['not-an-invitation-id', 'person@example.com'],
    [crypto.randomUUID(), 'not-an-email'],
    [crypto.randomUUID(), `${'a'.repeat(245)}@example.com`]
  ])('rejects malformed policy inputs before calling Cloudflare', async (invitationId, email) => {
    const fetcher = vi.fn<typeof fetch>();

    await expect(
      grantFamilyMemberAccess(configuration, invitationId, email, fetcher)
    ).rejects.toMatchObject({ code: 'request_failed' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    new Response('not json', { status: 502 }),
    Response.json({ success: false, errors: [{ message: 'private detail' }] }, { status: 400 }),
    Response.json({ success: true, result: { id: 'not-a-policy-id' } }),
    new Response('x'.repeat(65 * 1024))
  ])('rejects failed, malformed, or oversized API responses', async (response) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response);

    await expect(
      grantFamilyMemberAccess(configuration, crypto.randomUUID(), 'person@example.com', fetcher)
    ).rejects.toMatchObject({ code: 'request_failed' });
  });

  it('turns network errors into a safe family-facing failure', async () => {
    const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new Error('token leaked here'));

    await expect(
      grantFamilyMemberAccess(configuration, crypto.randomUUID(), 'person@example.com', fetcher)
    ).rejects.not.toThrow('token leaked here');
  });

  it('can remove a policy created for an invitation cleanup', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }));
    const policyId = crypto.randomUUID();

    await expect(
      revokeFamilyMemberAccess(configuration, policyId, fetcher)
    ).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledWith(
      `https://api.cloudflare.com/client/v4/accounts/0123456789abcdef0123456789abcdef/access/apps/870fa30d-1350-4d8c-92e6-7f005f6f878f/policies/${policyId}`,
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('rejects an unsuccessful policy deletion envelope', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ success: false, result: null }));

    await expect(
      revokeFamilyMemberAccess(configuration, crypto.randomUUID(), fetcher)
    ).rejects.toMatchObject({ code: 'request_failed' });
  });

  it('reuses the exact matching policy when repairing an interrupted invitation', async () => {
    const invitationId = crypto.randomUUID();
    const policyId = crypto.randomUUID();
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        success: true,
        result: [
          {
            id: policyId,
            name: `Family Wishlist member ${invitationId.slice(0, 8)}`,
            decision: 'allow',
            include: [{ email: { email: 'person@example.com' } }]
          }
        ]
      })
    );

    await expect(
      ensureFamilyMemberAccess(configuration, invitationId, 'person@example.com', null, fetcher)
    ).resolves.toBe(policyId);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0]?.[1]?.method).toBe('GET');
  });

  it('creates a policy only when reconciliation finds no exact match', async () => {
    const invitationId = crypto.randomUUID();
    const policyId = crypto.randomUUID();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ success: true, result: [] }))
      .mockResolvedValueOnce(Response.json({ success: true, result: { id: policyId } }));

    await expect(
      ensureFamilyMemberAccess(configuration, invitationId, 'person@example.com', null, fetcher)
    ).resolves.toBe(policyId);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('removes a recorded stale policy before replacing it during repair', async () => {
    const invitationId = crypto.randomUUID();
    const stalePolicyId = crypto.randomUUID();
    const replacementPolicyId = crypto.randomUUID();
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ success: true, result: [] }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(Response.json({ success: true, result: { id: replacementPolicyId } }));

    await expect(
      ensureFamilyMemberAccess(
        configuration,
        invitationId,
        'person@example.com',
        stalePolicyId,
        fetcher
      )
    ).resolves.toBe(replacementPolicyId);
    expect(fetcher.mock.calls.map((call) => call[1]?.method)).toEqual(['GET', 'DELETE', 'POST']);
  });

  it('fails closed when reconciliation finds duplicate exact policies', async () => {
    const invitationId = crypto.randomUUID();
    const candidate = (id: string) => ({
      id,
      name: `Family Wishlist member ${invitationId.slice(0, 8)}`,
      decision: 'allow',
      include: [{ email: { email: 'person@example.com' } }]
    });
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        success: true,
        result: [candidate(crypto.randomUUID()), candidate(crypto.randomUUID())]
      })
    );

    await expect(
      ensureFamilyMemberAccess(configuration, invitationId, 'person@example.com', null, fetcher)
    ).rejects.toMatchObject({ code: 'request_failed' });
  });

  it('treats an already deleted policy as successfully revoked', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 404 }));
    await expect(
      revokeFamilyMemberAccess(configuration, crypto.randomUUID(), fetcher)
    ).resolves.toBeUndefined();
  });

  it('revokes every application session after member removal', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ success: true, result: null }));

    await expect(revokeFamilyAccessSessions(configuration, fetcher)).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledWith(
      'https://api.cloudflare.com/client/v4/accounts/0123456789abcdef0123456789abcdef/access/apps/870fa30d-1350-4d8c-92e6-7f005f6f878f/revoke_tokens',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
