import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureMemberForEmail } from '../app/lib/db/members';
import {
  createWishlistShareLink,
  listActiveWishlistShareLinks,
  revokeWishlistShareLink
} from '../app/lib/db/shared-wishlists';
import { loader } from '../app/routes/shared-wishlist-image';
import { createAppWorker } from '../workers/app';
import { inviteAndProvisionMember } from './family-fixtures';

const origin = 'https://wishlist.example';
const worker = createAppWorker(async (request, context) => {
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  return loader({
    request,
    context,
    params: { token: parts[2], itemId: parts[4] },
    pattern: '/shared/:token/image/:itemId',
    url
  });
});

async function loadImage(token: string, itemId: string, headers: HeadersInit = {}, method = 'GET') {
  const ctx = createExecutionContext();
  const request = new Request(`${origin}/shared/${token}/image/${itemId}`, {
    method,
    headers
  }) as Parameters<NonNullable<typeof worker.fetch>>[0];
  const response = await worker.fetch!(request, env, ctx);
  await waitOnExecutionContext(ctx);
  return response;
}

async function fixture(imageCount = 1) {
  const owner = await ensureMemberForEmail(
    env.DB,
    'image-owner@example.com',
    'image-owner@example.com'
  );
  const items = Array.from({ length: imageCount }, (_, index) => ({
    id: crypto.randomUUID(),
    imageUrl: `https://cdn.example/${crypto.randomUUID()}/${index}.png`
  }));
  await env.DB.batch(
    items.map((item) =>
      env.DB.prepare(
        'INSERT INTO items (id, wishlist_id, title, image_url, priority, created_by_member_id) VALUES (?1, ?2, ?3, ?4, ?5, ?6)'
      ).bind(item.id, owner.wishlistId, 'A gift', item.imageUrl, 'normal', owner.id)
    )
  );
  const token = await createWishlistShareLink(env.DB, owner.id, owner.wishlistId, 'Image test');
  return { owner, items, token };
}

describe('shared image caching and access', () => {
  beforeEach(async () => {
    await env.DB.batch(
      [
        'shared_image_requester_limits',
        'shared_image_fetch_limits',
        'family_share_links',
        'wishlist_share_links',
        'claims',
        'items',
        'wishlists',
        'family_invitations',
        'members'
      ].map((table) => env.DB.prepare(`DELETE FROM ${table}`))
    );
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockImplementation(() =>
        Promise.resolve(
          new Response(new Uint8Array([1, 2, 3]), {
            headers: { 'Content-Type': 'image/png', 'Set-Cookie': 'shop-tracking=private' }
          })
        )
      )
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reuses validated edge bytes across repeated requests and independent sharing links', async () => {
    const f = await fixture();
    const first = await loadImage(f.token, f.items[0].id, {
      Cookie: 'private-cookie',
      Authorization: 'private-auth'
    });
    expect(first.status).toBe(200);
    expect(first.headers.get('Cache-Control')).toBe('private, no-cache');
    expect(first.headers.get('Cache-Status')).toBe('FamilyWishlist; fwd=uri-miss');
    expect(first.headers.has('Set-Cookie')).toBe(false);
    expect(first.headers.has('X-Shared-Image-Proxy')).toBe(false);
    expect(await first.arrayBuffer()).toHaveProperty('byteLength', 3);
    const secondToken = await createWishlistShareLink(
      env.DB,
      f.owner.id,
      f.owner.wishlistId,
      'Another friend'
    );
    for (let index = 0; index < 25; index++) {
      const response = await loadImage(index % 2 ? f.token : secondToken, f.items[0].id);
      expect(response.status).toBe(200);
      expect(response.headers.get('Cache-Status')).toBe('FamilyWishlist; hit');
      await response.arrayBuffer();
    }
    expect(fetch).toHaveBeenCalledOnce();
    const [, init] = vi.mocked(fetch).mock.calls[0];
    const upstreamHeaders = new Headers(init?.headers);
    expect(upstreamHeaders.has('Cookie')).toBe(false);
    expect(upstreamHeaders.has('Authorization')).toBe(false);
    expect(upstreamHeaders.has('Referer')).toBe(false);
    expect(
      await env.DB.prepare('SELECT day_request_count FROM shared_image_fetch_limits').first()
    ).toEqual({ day_request_count: 1 });
  });

  it('loads more than both old visitor limits and reuses images even when fetch budgets are exhausted', async () => {
    const f = await fixture(120);
    const responses = await Promise.all(f.items.map((item) => loadImage(f.token, item.id)));
    expect(responses.every((response) => response.status === 200)).toBe(true);
    for (const response of responses) await response.arrayBuffer();
    expect(fetch).toHaveBeenCalledTimes(120);
    await env.DB.prepare(
      'UPDATE shared_image_fetch_limits SET minute_request_count = 99999, day_request_count = 99999'
    ).run();
    await env.DB.prepare(
      'UPDATE shared_image_requester_limits SET minute_request_count = 99999, day_request_count = 99999'
    ).run();
    const cached = await loadImage(f.token, f.items[0].id);
    expect(cached.status).toBe(200);
    expect(cached.headers.get('Cache-Status')).toBe('FamilyWishlist; hit');
    const revalidated = await loadImage(f.token, f.items[0].id, {
      'If-None-Match': responses[0].headers.get('ETag')!
    });
    expect(revalidated.status).toBe(304);
    expect(await revalidated.text()).toBe('');
    expect(fetch).toHaveBeenCalledTimes(120);
  });

  it('rechecks revocation and disabled owners before using either browser or edge caches', async () => {
    const f = await fixture();
    const response = await loadImage(f.token, f.items[0].id);
    await response.arrayBuffer();
    const etag = response.headers.get('ETag')!;
    const secondToken = await createWishlistShareLink(
      env.DB,
      f.owner.id,
      f.owner.wishlistId,
      'Still active'
    );
    const links = await listActiveWishlistShareLinks(env.DB, f.owner.id);
    const firstLink = links.find((link) => link.name === 'Image test')!;
    await revokeWishlistShareLink(env.DB, f.owner.id, firstLink.id);
    expect((await loadImage(f.token, f.items[0].id, { 'If-None-Match': etag })).status).toBe(404);
    expect((await loadImage(f.token, f.items[0].id)).status).toBe(404);
    const stillActive = await loadImage(secondToken, f.items[0].id);
    expect(stillActive.status).toBe(200);
    await stillActive.arrayBuffer();
    await env.DB.prepare('UPDATE members SET disabled_at = ?1 WHERE id = ?2')
      .bind('2026-10-10', f.owner.id)
      .run();
    for (const headers of [new Headers(), new Headers({ 'If-None-Match': etag })])
      expect((await loadImage(secondToken, f.items[0].id, headers)).status).toBe(404);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('does not reuse old bytes when the item picture changes, or serve them on unrelated lists', async () => {
    const f = await fixture();
    const response = await loadImage(f.token, f.items[0].id);
    await response.arrayBuffer();
    const etag = response.headers.get('ETag')!;
    const other = await inviteAndProvisionMember(env.DB, f.owner, 'other-owner@example.com');
    const unrelated = await createWishlistShareLink(
      env.DB,
      other.id,
      other.wishlistId,
      'Another list'
    );
    expect((await loadImage(unrelated, f.items[0].id, { 'If-None-Match': etag })).status).toBe(404);
    await env.DB.prepare('UPDATE items SET image_url = ?1 WHERE id = ?2')
      .bind(`https://cdn.example/${crypto.randomUUID()}/replacement.png`, f.items[0].id)
      .run();
    const changed = await loadImage(f.token, f.items[0].id, { 'If-None-Match': etag });
    expect(changed.status).toBe(200);
    expect(changed.headers.get('ETag')).not.toBe(etag);
    await changed.arrayBuffer();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('answers HEAD without fetching or budgeting and never caches unsupported upstream data', async () => {
    const f = await fixture();
    expect((await loadImage(f.token, f.items[0].id, {}, 'HEAD')).status).toBe(200);
    expect(fetch).not.toHaveBeenCalled();
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM shared_image_fetch_limits').first()
    ).toEqual({ count: 0 });
    vi.mocked(fetch).mockImplementation(() =>
      Promise.resolve(new Response('<unsafe>', { headers: { 'Content-Type': 'image/svg+xml' } }))
    );
    for (let index = 0; index < 2; index++)
      expect((await loadImage(f.token, f.items[0].id)).status).toBe(404);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('keeps browser revalidation working when edge caching is unavailable', async () => {
    const f = await fixture();
    vi.spyOn(caches, 'open').mockRejectedValue(new Error('Cache unavailable'));
    const response = await loadImage(f.token, f.items[0].id);
    expect(response.status).toBe(200);
    await response.arrayBuffer();
    expect(
      (
        await loadImage(f.token, f.items[0].id, {
          'If-None-Match': `"unrelated", ${response.headers.get('ETag')!}`
        })
      ).status
    ).toBe(304);
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('refreshes the shop picture on the next UTC day even if its URL is unchanged', async () => {
    const f = await fixture();
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now);
    const first = await loadImage(f.token, f.items[0].id);
    await first.arrayBuffer();
    clock.mockReturnValue(now + 86_400_000);
    const nextDay = await loadImage(f.token, f.items[0].id, {
      'If-None-Match': first.headers.get('ETag')!
    });
    expect(nextDay.status).toBe(200);
    expect(nextDay.headers.get('ETag')).not.toBe(first.headers.get('ETag'));
    await nextDay.arrayBuffer();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not expose an internal cache key as a public image route', async () => {
    const request = new Request(
      `${origin}/shared/__image-cache/v1/${'a'.repeat(64)}.1`
    ) as Parameters<NonNullable<typeof worker.fetch>>[0];
    const response = await worker.fetch!(request, env, createExecutionContext());
    expect(response.status).toBe(503);
    expect(fetch).not.toHaveBeenCalled();
  });
});
