import { createExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { RouterContextProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cloudflareContext, identityContext, type RuntimeEnv } from '../app/lib/context';
import { listFamilyPeople } from '../app/lib/db/family-members';
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
});
