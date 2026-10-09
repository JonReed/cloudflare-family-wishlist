import { createExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { RouterContextProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { cloudflareContext } from '../app/lib/context';
import {
  activateFamilyInvitation,
  beginFamilyInvitation,
  completeFamilyMemberRemoval,
  prepareFamilyMemberRemoval
} from '../app/lib/db/family-members';
import { ensureMemberForEmail } from '../app/lib/db/members';
import {
  createFamilyShareLink,
  createWishlistShareLink,
  getSharedWishlist,
  getSharedWishlists,
  getSharedWishlistImageUrl,
  listShareableWishlists
} from '../app/lib/db/shared-wishlists';
import {
  claimWishlistItem,
  createWishlistItem,
  createWishlistItems,
  deleteWishlistItem,
  listFamilyWishlists,
  setOwnClaimState,
  unclaimWishlistItem,
  updateWishlistItem
} from '../app/lib/db/wishlists';
import { loader as sharedLoader } from '../app/routes/shared-wishlist';
import { loader as sharedImageLoader } from '../app/routes/shared-wishlist-image';
import { inviteAndProvisionMember } from './family-fixtures';

const input = {
  title: 'Saved wish',
  notes: '',
  productUrl: '',
  imageUrl: 'https://cdn.example.com/gift.webp',
  price: '',
  priority: 'normal'
};

function publicContext() {
  const context = new RouterContextProvider();
  context.set(cloudflareContext, { env, ctx: createExecutionContext(), cspNonce: 'test' });
  return context;
}

function loadShared(token: string, method = 'GET') {
  const request = new Request(`https://wishlist.example/shared/${token}`, { method });
  return sharedLoader({
    request,
    params: { token },
    context: publicContext(),
    pattern: '/shared/:token',
    url: new URL(request.url)
  });
}

async function fixture() {
  const admin = await ensureMemberForEmail(env.DB, 'admin@example.com', 'admin@example.com');
  const owner = await inviteAndProvisionMember(env.DB, admin, 'removed@example.com');
  const other = await inviteAndProvisionMember(env.DB, admin, 'other@example.com');
  for (const member of [owner, other])
    await createWishlistItem(env.DB, admin.id, member.wishlistId, input);
  const lists = await listFamilyWishlists(env.DB, admin.id);
  const ownerItem = lists.find((list) => list.id === owner.wishlistId)?.items[0];
  const otherItem = lists.find((list) => list.id === other.wishlistId)?.items[0];
  if (!ownerItem || !otherItem) throw new Error('Expected wishlist items');
  await claimWishlistItem(env.DB, admin.id, ownerItem.id);
  await setOwnClaimState(env.DB, admin.id, ownerItem.id, 'purchased');
  const singleToken = await createWishlistShareLink(env.DB, admin.id, owner.wishlistId, 'Friend');
  const { token: groupToken } = await createFamilyShareLink(
    env.DB,
    admin.id,
    [owner.wishlistId, other.wishlistId],
    'Relatives'
  );
  return { admin, owner, other, ownerItem, otherItem, singleToken, groupToken };
}

describe('disabled wishlist visibility', () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM family_share_links'),
      env.DB.prepare('DELETE FROM wishlist_share_links'),
      env.DB.prepare('DELETE FROM claims'),
      env.DB.prepare('DELETE FROM items'),
      env.DB.prepare('DELETE FROM wishlists'),
      env.DB.prepare('DELETE FROM family_invitations'),
      env.DB.prepare('DELETE FROM members')
    ]);
  });

  afterEach(() => vi.unstubAllGlobals());

  it.each(['removing', 'removed', 'reinviting'])(
    'excludes disabled owners from family lists, sharing choices, public lists and pictures (%s)',
    async (state) => {
      const { admin, owner, other, ownerItem, otherItem, singleToken, groupToken } =
        await fixture();
      await prepareFamilyMemberRemoval(env.DB, admin.id, owner.id);
      if (state !== 'removing') await completeFamilyMemberRemoval(env.DB, owner.id);
      if (state === 'reinviting')
        await beginFamilyInvitation(env.DB, admin.id, {
          email: owner.email,
          displayName: owner.displayName
        });

      expect((await listFamilyWishlists(env.DB, admin.id)).map((list) => list.id)).toEqual([
        admin.wishlistId,
        other.wishlistId
      ]);
      expect(await listFamilyWishlists(env.DB, owner.id)).toEqual([]);
      expect((await listShareableWishlists(env.DB, admin.id)).map((list) => list.id)).not.toContain(
        owner.wishlistId
      );
      expect(await getSharedWishlist(env.DB, singleToken)).toBeNull();
      expect((await getSharedWishlists(env.DB, groupToken)).map((list) => list.id)).toEqual([
        other.wishlistId
      ]);
      for (const token of [singleToken, groupToken])
        expect(await getSharedWishlistImageUrl(env.DB, token, ownerItem.id)).toBeNull();
      expect(await getSharedWishlistImageUrl(env.DB, groupToken, otherItem.id)).not.toBeNull();
    }
  );

  it('rejects new links containing a disabled owner without partially saving the selection', async () => {
    const { admin, owner, other } = await fixture();
    await prepareFamilyMemberRemoval(env.DB, admin.id, owner.id);
    await expect(
      createWishlistShareLink(env.DB, admin.id, owner.wishlistId, 'Another friend')
    ).rejects.toThrow('couldn’t find that wishlist');
    await expect(
      createFamilyShareLink(env.DB, admin.id, [other.wishlistId, owner.wishlistId], 'New relatives')
    ).rejects.toThrow();
    expect(
      await env.DB.prepare('SELECT count(*) AS total FROM wishlist_share_links').first()
    ).toEqual({ total: 1 });
    expect(
      await env.DB.prepare('SELECT count(*) AS total FROM family_share_links').first()
    ).toEqual({ total: 1 });
    expect(
      await env.DB.prepare('SELECT count(*) AS total FROM family_share_link_wishlists').first()
    ).toEqual({ total: 2 });
  });

  it('rejects stale wish and claim mutations without changing retained data', async () => {
    const { admin, owner, other, ownerItem } = await fixture();
    await createWishlistItem(env.DB, admin.id, owner.wishlistId, {
      ...input,
      title: 'Unclaimed wish'
    });
    const unclaimed = (await listFamilyWishlists(env.DB, admin.id))
      .find((list) => list.id === owner.wishlistId)
      ?.items.find((item) => item.title === 'Unclaimed wish');
    if (!unclaimed) throw new Error('Expected an unclaimed wish');
    const itemsBefore = (await env.DB.prepare('SELECT * FROM items ORDER BY id').all()).results;
    const claimsBefore = (await env.DB.prepare('SELECT * FROM claims').all()).results;
    await prepareFamilyMemberRemoval(env.DB, admin.id, owner.id);

    await expect(createWishlistItem(env.DB, admin.id, owner.wishlistId, input)).rejects.toThrow();
    await expect(
      createWishlistItems(env.DB, admin.id, [other.wishlistId, owner.wishlistId], input)
    ).rejects.toThrow();
    await expect(
      updateWishlistItem(env.DB, ownerItem.id, { ...input, title: 'Changed' })
    ).rejects.toThrow();
    await expect(deleteWishlistItem(env.DB, ownerItem.id)).rejects.toThrow();
    await expect(claimWishlistItem(env.DB, other.id, unclaimed.id)).rejects.toThrow();
    await expect(setOwnClaimState(env.DB, admin.id, ownerItem.id, 'claimed')).rejects.toThrow();
    await expect(unclaimWishlistItem(env.DB, admin.id, ownerItem.id)).rejects.toThrow();
    expect((await env.DB.prepare('SELECT * FROM items ORDER BY id').all()).results).toEqual(
      itemsBefore
    );
    expect((await env.DB.prepare('SELECT * FROM claims').all()).results).toEqual(claimsBefore);
  });

  it('returns 404 for old public URLs and pictures, including HEAD, without fetching images', async () => {
    const { admin, owner, other, ownerItem, singleToken, groupToken } = await fixture();
    await prepareFamilyMemberRemoval(env.DB, admin.id, owner.id);
    for (const method of ['GET', 'HEAD'])
      await expect(loadShared(singleToken, method)).rejects.toMatchObject({
        data: 'Not found',
        init: { status: 404 }
      });
    expect((await loadShared(groupToken)).data.wishlists.map((list) => list.id)).toEqual([
      other.wishlistId
    ]);
    await prepareFamilyMemberRemoval(env.DB, admin.id, other.id);
    for (const method of ['GET', 'HEAD'])
      await expect(loadShared(groupToken, method)).rejects.toMatchObject({
        data: 'Not found',
        init: { status: 404 }
      });
    const fetcher = vi.fn(() => Promise.resolve(new Response('unexpected image')));
    vi.stubGlobal('fetch', fetcher);
    for (const token of [singleToken, groupToken]) {
      for (const method of ['GET', 'HEAD']) {
        const request = new Request(
          `https://wishlist.example/shared/${token}/image/${ownerItem.id}`,
          { method }
        );
        const response = await sharedImageLoader({
          request,
          params: { token, itemId: ownerItem.id },
          context: publicContext(),
          pattern: '/shared/:token/image/:itemId',
          url: new URL(request.url)
        });
        expect(response.status).toBe(404);
      }
    }
    expect(fetcher).not.toHaveBeenCalled();
    expect(
      await env.DB.prepare('SELECT count(*) AS total FROM shared_image_fetch_limits').first()
    ).toEqual({ total: 0 });
  });

  it('restores the same saved list and viewing links only after successful re-invitation', async () => {
    const { admin, owner, ownerItem, singleToken, groupToken } = await fixture();
    await prepareFamilyMemberRemoval(env.DB, admin.id, owner.id);
    await completeFamilyMemberRemoval(env.DB, owner.id);
    const invitation = await beginFamilyInvitation(env.DB, admin.id, {
      email: owner.email,
      displayName: owner.displayName
    });
    expect(await getSharedWishlist(env.DB, singleToken)).toBeNull();
    await activateFamilyInvitation(env.DB, invitation.id, crypto.randomUUID());
    const restored = await getSharedWishlist(env.DB, singleToken);
    expect(restored).toMatchObject({
      id: owner.wishlistId,
      items: [{ id: ownerItem.id, title: input.title }]
    });
    expect(JSON.stringify(restored)).not.toContain('claim');
    expect(JSON.stringify(restored)).not.toContain('purchased');
    expect((await getSharedWishlists(env.DB, groupToken)).map((list) => list.id)).toContain(
      owner.wishlistId
    );
    const ownList = (await listFamilyWishlists(env.DB, owner.id)).find(
      (list) => list.id === owner.wishlistId
    );
    expect(ownList?.items[0]).toMatchObject({ id: ownerItem.id, claimVisibility: 'hidden' });
    expect(ownList?.items[0]).not.toHaveProperty('claim');
  });
});
