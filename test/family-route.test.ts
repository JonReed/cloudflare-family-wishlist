import { createExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { RouterContextProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cloudflareContext, identityContext, type RuntimeEnv } from '../app/lib/context';
import { listFamilyPeople } from '../app/lib/db/family-members';
import { ensureMemberForEmail } from '../app/lib/db/members';
import { action } from '../app/routes/family';

const organiserEmail = 'route-admin@example.com';

function actionContext(): RouterContextProvider {
  const context = new RouterContextProvider();
  const runtimeEnv: RuntimeEnv = {
    ...env,
    INITIAL_ORGANISER_EMAIL: organiserEmail,
    ACCESS_MANAGEMENT_ACCOUNT_ID: 'a'.repeat(32),
    ACCESS_MANAGEMENT_APPLICATION_ID: '11111111-1111-4111-8111-111111111111',
    ACCESS_MANAGEMENT_API_TOKEN: 'test-token'
  };

  context.set(cloudflareContext, {
    env: runtimeEnv,
    ctx: createExecutionContext(),
    cspNonce: 'test-nonce'
  });
  context.set(identityContext, { email: organiserEmail, subject: 'route-admin' });
  return context;
}

function stubSuccessfulAccessPolicy(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve(
        Response.json({ success: true, result: { id: crypto.randomUUID() } }, { status: 200 })
      )
    )
  );
}

function addMemberRequest(email: string, enhanced: boolean): Request {
  return new Request('https://wishlist.example/family', {
    method: 'POST',
    body: new URLSearchParams({
      intent: 'add-member',
      displayName: 'Jamie Reed',
      email,
      enhancedAddMember: String(enhanced)
    })
  });
}

function submitFamilyRequest(request: Request) {
  return action({
    request,
    context: actionContext(),
    params: {},
    pattern: '/family',
    url: new URL(request.url)
  });
}

function removeMemberRequest(memberId: string): Request {
  return new Request('https://wishlist.example/family', {
    method: 'POST',
    body: new URLSearchParams({ intent: 'remove-member', memberId })
  });
}

describe('family route', () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM product_lookup_limits'),
      env.DB.prepare('DELETE FROM claims'),
      env.DB.prepare('DELETE FROM items'),
      env.DB.prepare('DELETE FROM wishlists'),
      env.DB.prepare('DELETE FROM family_invitations'),
      env.DB.prepare('DELETE FROM members')
    ]);
    stubSuccessfulAccessPolicy();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns structured success for an enhanced add after provisioning the member', async () => {
    const request = addMemberRequest('jamie@example.com', true);
    const result = await action({
      request,
      context: actionContext(),
      params: {},
      pattern: '/family',
      url: new URL(request.url)
    });

    expect(result).toEqual({ added: true });
    await expect(listFamilyPeople(env.DB)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ displayName: 'Jamie Reed', email: 'jamie@example.com' })
      ])
    );
  });

  it('retains post-redirect-get for an unenhanced add', async () => {
    const request = addMemberRequest('jamie@example.com', false);
    const result = await action({
      request,
      context: actionContext(),
      params: {},
      pattern: '/family',
      url: new URL(request.url)
    });

    expect(result).toBeInstanceOf(Response);
    if (!(result instanceof Response)) throw new Error('Expected a redirect response');
    expect(result.status).toBe(302);
    expect(result.headers.get('Location')).toBe('/family?added=1');
  });

  it.each([false, true])(
    're-adds a removed person through the form (enhanced: %s)',
    async (enhanced) => {
      await submitFamilyRequest(addMemberRequest('jamie@example.com', true));
      const member = await ensureMemberForEmail(env.DB, 'jamie@example.com');
      await submitFamilyRequest(removeMemberRequest(member.id));
      await expect(ensureMemberForEmail(env.DB, member.email)).rejects.toThrow(
        'no longer has access'
      );

      const result = await submitFamilyRequest(addMemberRequest('JAMIE@example.com', enhanced));
      if (enhanced) {
        expect(result).toEqual({ added: true });
      } else {
        expect(result).toBeInstanceOf(Response);
        if (!(result instanceof Response)) throw new Error('Expected a redirect response');
        expect(result.headers.get('Location')).toBe('/family?added=1');
      }
      expect(await ensureMemberForEmail(env.DB, member.email)).toEqual(member);
      const policyRequest = vi.mocked(fetch).mock.calls.at(-1)?.[1];
      expect(policyRequest?.method).toBe('POST');
      if (typeof policyRequest?.body !== 'string') throw new Error('Expected a JSON policy body');
      expect(JSON.parse(policyRequest.body)).toMatchObject({
        decision: 'allow',
        include: [{ email: { email: member.email } }]
      });
    }
  );

  it('keeps a removed person disabled after an Access failure and allows retrying', async () => {
    await submitFamilyRequest(addMemberRequest('jamie@example.com', true));
    const member = await ensureMemberForEmail(env.DB, 'jamie@example.com');
    await submitFamilyRequest(removeMemberRequest(member.id));
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        await expect(ensureMemberForEmail(env.DB, member.email)).rejects.toThrow(
          'no longer has access'
        );
        return Response.json({ success: false }, { status: 503 });
      })
    );

    const result = await submitFamilyRequest(addMemberRequest(member.email, true));
    expect(result).toMatchObject({ init: { status: 400 } });
    if (!('data' in result)) throw new Error('Expected an action error');
    expect(result.data.error).toContain('Cloudflare could not add');
    await expect(ensureMemberForEmail(env.DB, member.email)).rejects.toThrow(
      'no longer has access'
    );
    stubSuccessfulAccessPolicy();
    expect(await submitFamilyRequest(addMemberRequest(member.email, true))).toEqual({
      added: true
    });
    expect(await ensureMemberForEmail(env.DB, member.email)).toEqual(member);
  });

  it.each([true, false])(
    'keeps a failed re-add disabled until retry or repair succeeds (Access cleanup: %s)',
    async (cleanupSucceeded) => {
      await submitFamilyRequest(addMemberRequest('jamie@example.com', true));
      const member = await ensureMemberForEmail(env.DB, 'jamie@example.com');
      await submitFamilyRequest(removeMemberRequest(member.id));
      const policyId = crypto.randomUUID();
      const fetcher = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        if (init?.method === 'DELETE' && !cleanupSucceeded)
          return Promise.resolve(Response.json({ success: false }, { status: 503 }));
        return Promise.resolve(Response.json({ success: true, result: { id: policyId } }));
      });
      vi.stubGlobal('fetch', fetcher);
      await env.DB.prepare(
        "CREATE TRIGGER fail_returning_wishlist BEFORE INSERT ON wishlists BEGIN SELECT RAISE(ABORT, 'test failure'); END"
      ).run();
      try {
        await expect(submitFamilyRequest(addMemberRequest(member.email, true))).rejects.toThrow(
          'test failure'
        );
      } finally {
        await env.DB.prepare('DROP TRIGGER fail_returning_wishlist').run();
      }
      expect(fetcher.mock.calls.map((call) => call[1]?.method)).toEqual(['POST', 'DELETE']);
      await expect(ensureMemberForEmail(env.DB, member.email)).rejects.toThrow(
        'no longer has access'
      );

      if (cleanupSucceeded) {
        expect(
          await env.DB.prepare('SELECT id FROM family_invitations WHERE email = ?1')
            .bind(member.email)
            .first()
        ).toBeNull();
        stubSuccessfulAccessPolicy();
        expect(await submitFamilyRequest(addMemberRequest(member.email, true))).toEqual({
          added: true
        });
      } else {
        const invitation = await env.DB.prepare(
          'SELECT id, status, access_policy_id FROM family_invitations WHERE email = ?1'
        )
          .bind(member.email)
          .first<{ id: string; status: string; access_policy_id: string }>();
        if (!invitation) throw new Error('Expected repairable re-invitation');
        expect(invitation).toMatchObject({
          status: 'cleanup_required',
          access_policy_id: policyId
        });
        expect(await listFamilyPeople(env.DB)).toContainEqual(
          expect.objectContaining({ id: invitation.id, status: 'attention' })
        );
        fetcher.mockClear().mockResolvedValue(
          Response.json({
            success: true,
            result: [
              {
                id: policyId,
                name: `Family Wishlist member ${invitation.id.slice(0, 8)}`,
                decision: 'allow',
                include: [{ email: { email: member.email } }]
              }
            ],
            result_info: { page: 1, count: 1, total_count: 1, total_pages: 1 }
          })
        );
        const repaired = await submitFamilyRequest(
          new Request('https://wishlist.example/family', {
            method: 'POST',
            body: new URLSearchParams({
              intent: 'repair-invitation',
              invitationId: invitation.id
            })
          })
        );
        expect(repaired).toBeInstanceOf(Response);
        if (!(repaired instanceof Response)) throw new Error('Expected repair redirect');
        expect(repaired.headers.get('Location')).toBe('/family?repaired=1');
        expect(fetcher.mock.calls.map((call) => call[1]?.method)).toEqual(['GET']);
      }
      expect(await ensureMemberForEmail(env.DB, member.email)).toEqual(member);
    }
  );
});
