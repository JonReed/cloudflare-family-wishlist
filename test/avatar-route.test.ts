import { createExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { RouterContextProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cloudflareContext, identityContext } from '../app/lib/context';
import { ensureMemberForEmail } from '../app/lib/db/members';
import { loader } from '../app/routes/avatar';
import { createAppWorker } from '../workers/app';
import { inviteAndProvisionMember } from './family-fixtures';

const organiserEmail = 'avatar-admin@example.com';

function loadAvatar(memberId: string, email = organiserEmail, method = 'GET') {
  const context = new RouterContextProvider();
  context.set(cloudflareContext, {
    env: { ...env, INITIAL_ORGANISER_EMAIL: organiserEmail },
    ctx: createExecutionContext(),
    cspNonce: 'test-nonce'
  });
  context.set(identityContext, { email, subject: email });
  const request = new Request(`https://wishlist.example/avatar/${memberId}`, { method });
  return loader({
    request,
    context,
    params: { memberId },
    pattern: '/avatar/:memberId',
    url: new URL(request.url)
  });
}

describe('private member avatars', () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM product_image_fetch_limits'),
      env.DB.prepare('DELETE FROM claims'),
      env.DB.prepare('DELETE FROM items'),
      env.DB.prepare('DELETE FROM wishlists'),
      env.DB.prepare('DELETE FROM family_invitations'),
      env.DB.prepare('DELETE FROM members')
    ]);
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 404 }))
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('lets an admitted viewer see another member’s initials without exposing their email', async () => {
    const viewer = await ensureMemberForEmail(env.DB, organiserEmail, organiserEmail);
    const owner = await inviteAndProvisionMember(
      env.DB,
      viewer,
      'private-owner@example.com',
      'Jamie Reed'
    );
    const response = await loadAvatar(owner.id);
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(body).toContain('>JR</text>');
    expect(body).not.toContain(owner.email);
    expect(body).not.toContain('gravatar.com');
    expect(body).not.toContain('claim');
  });

  it.each(['not-a-uuid', '11111111-1111-4111-8111-111111111111'])(
    'rejects unknown or malformed member IDs: %s',
    async (id) => {
      await ensureMemberForEmail(env.DB, organiserEmail, organiserEmail);
      expect((await loadAvatar(id)).status).toBe(404);
      expect(fetch).not.toHaveBeenCalled();
    }
  );

  it('rejects an uninvited or removed viewer before looking up a photo', async () => {
    const viewer = await ensureMemberForEmail(env.DB, organiserEmail, organiserEmail);
    expect((await loadAvatar(viewer.id, 'uninvited@example.com')).status).toBe(403);
    await env.DB.prepare('UPDATE members SET disabled_at = ?1 WHERE id = ?2')
      .bind('2026-10-03', viewer.id)
      .run();
    expect((await loadAvatar(viewer.id)).status).toBe(403);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('stops serving a removed member’s photo to other admitted viewers', async () => {
    const viewer = await ensureMemberForEmail(env.DB, organiserEmail, organiserEmail);
    const owner = await inviteAndProvisionMember(env.DB, viewer, 'removed-owner@example.com');
    await env.DB.prepare('UPDATE members SET disabled_at = ?1 WHERE id = ?2')
      .bind('2026-10-03', owner.id)
      .run();
    expect((await loadAvatar(owner.id)).status).toBe(404);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('answers HEAD without consuming the image budget or fetching upstream', async () => {
    const viewer = await ensureMemberForEmail(env.DB, organiserEmail, organiserEmail);
    const response = await loadAvatar(viewer.id, organiserEmail, 'HEAD');
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
    expect(fetch).not.toHaveBeenCalled();
    expect(await env.DB.prepare('SELECT * FROM product_image_fetch_limits').all()).toMatchObject({
      results: []
    });
  });

  it('uses a local fallback when the viewer’s image budget is exhausted', async () => {
    const viewer = await ensureMemberForEmail(env.DB, organiserEmail, organiserEmail);
    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      'INSERT INTO product_image_fetch_limits (member_id, minute_started_at, minute_request_count, day_started_at, day_request_count) VALUES (?1, ?2, 60, ?3, 500)'
    )
      .bind(viewer.id, Math.floor(now / 60) * 60, Math.floor(now / 86400) * 86400)
      .run();
    expect((await loadAvatar(viewer.id)).headers.get('Content-Type')).toBe('image/svg+xml');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps the avatar endpoint behind the Worker’s Access boundary', async () => {
    const router = vi.fn(() => Promise.resolve(new Response('private photo')));
    const worker = createAppWorker(router);
    if (!worker.fetch) throw new Error('Worker fixture has no fetch handler.');
    const request = new Request(
      'https://wishlist.example/avatar/11111111-1111-4111-8111-111111111111'
    ) as Parameters<typeof worker.fetch>[0];
    const response = await worker.fetch(request, env, createExecutionContext());
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(router).not.toHaveBeenCalled();
  });
});
