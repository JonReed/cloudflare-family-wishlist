import { createExecutionContext, env } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import { cloudflareContext } from '../app/lib/context';
import { ensureMemberForEmail } from '../app/lib/db/members';
import {
  getSharedWishlist,
  createWishlistShareLink,
  listActiveWishlistShareLinks,
  revokeWishlistShareLink
} from '../app/lib/db/shared-wishlists';
import {
  claimWishlistItem,
  createWishlistItem,
  listFamilyWishlists,
  setOwnClaimState
} from '../app/lib/db/wishlists';
import { createAppWorker } from '../workers/app';
import { inviteAndProvisionMember } from './family-fixtures';

const origin = 'https://wishlist.example';

describe('public share Worker boundary', () => {
  const worker = createAppWorker(async (request, context) => {
    const token = new URL(request.url).pathname.split('/')[2];
    if (!token) return new Response('Not found.', { status: 404 });
    const { env: runtimeEnv } = context.get(cloudflareContext);
    const wishlist = await getSharedWishlist(runtimeEnv.DB, token);
    if (!wishlist) return new Response('Not found.', { status: 404 });
    return Response.json(wishlist);
  });

  function fetchWorker(path: string, init?: RequestInit) {
    const fetch = worker.fetch;
    if (!fetch) throw new Error('Worker fixture has no fetch handler.');
    const request = new Request(`${origin}${path}`, init) as Parameters<typeof fetch>[0];
    return fetch(request, env, createExecutionContext());
  }

  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM shared_image_requester_limits'),
      env.DB.prepare('DELETE FROM shared_image_fetch_limits'),
      env.DB.prepare('DELETE FROM wishlist_share_links'),
      env.DB.prepare('DELETE FROM claims'),
      env.DB.prepare('DELETE FROM items'),
      env.DB.prepare('DELETE FROM wishlists'),
      env.DB.prepare('DELETE FROM family_invitations'),
      env.DB.prepare('DELETE FROM members')
    ]);
  });

  async function sharedFixture() {
    const owner = await ensureMemberForEmail(env.DB, 'owner@example.com', 'owner@example.com');
    const giver = await inviteAndProvisionMember(env.DB, owner, 'giver@example.com');
    await createWishlistItem(env.DB, owner.id, owner.wishlistId, {
      title: 'A private surprise',
      notes: 'The green one',
      productUrl: 'https://example.com/gift',
      imageUrl: 'https://cdn.example.com/gift.webp',
      price: '24.50',
      priority: 'high'
    });
    const itemId = (await listFamilyWishlists(env.DB, giver.id)).find(
      (wishlist) => wishlist.id === owner.wishlistId
    )?.items[0]?.id;
    if (!itemId) throw new Error('Shared-list fixture did not create an item.');
    await claimWishlistItem(env.DB, giver.id, itemId);
    await setOwnClaimState(env.DB, giver.id, itemId, 'purchased');
    const token = await createWishlistShareLink(
      env.DB,
      owner.id,
      owner.wishlistId,
      'Family friend'
    );
    return { owner, giver, itemId, token };
  }

  it('bypasses Access only for exact GET and HEAD share paths', async () => {
    const { itemId, token } = await sharedFixture();

    expect((await fetchWorker(`/shared/${token}`)).status).toBe(200);
    expect((await fetchWorker(`/shared/${token}`, { method: 'HEAD' })).status).toBe(200);
    expect((await fetchWorker(`/shared/${token}/image/${itemId}`, { method: 'HEAD' })).status).toBe(
      200
    );
    expect((await fetchWorker(`/shared/${token}/edit`)).status).toBe(503);
    expect((await fetchWorker('/shared/not-a-capability')).status).toBe(503);
    expect(
      (
        await fetchWorker(`/shared/${token}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Origin: origin
          },
          body: 'intent=create-share-link&shareLinkName=Friend'
        })
      ).status
    ).toBe(503);
  });

  it('keeps claims out of public responses and revokes only the selected link', async () => {
    const { owner, giver, token: oldToken } = await sharedFixture();
    const oldResponse = await (await fetchWorker(`/shared/${oldToken}`)).text();

    expect(oldResponse).toContain('A private surprise');
    expect(oldResponse).not.toContain('purchased');
    expect(oldResponse).not.toContain('claimed');
    expect(oldResponse).not.toContain(giver.id);
    expect(oldResponse).not.toContain('Family friend');

    const newToken = await createWishlistShareLink(env.DB, owner.id, owner.wishlistId, 'Neighbour');
    expect((await fetchWorker(`/shared/${oldToken}`)).status).toBe(200);
    expect((await fetchWorker(`/shared/${newToken}`)).status).toBe(200);

    const links = await listActiveWishlistShareLinks(env.DB, owner.id);
    const linkToRevoke = links[0];
    if (!linkToRevoke) throw new Error('Expected an active viewing link.');
    await revokeWishlistShareLink(env.DB, owner.id, linkToRevoke.id);
    const oldStatus = (await fetchWorker(`/shared/${oldToken}`)).status;
    const newStatus = (await fetchWorker(`/shared/${newToken}`)).status;
    const statuses = [oldStatus, newStatus];
    expect(statuses.sort()).toEqual([200, 404]);
  });
});
