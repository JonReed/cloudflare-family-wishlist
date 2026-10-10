import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { ensureMemberForEmail, type MemberWithWishlist } from '../app/lib/db/members';
import {
  getSharedWishlist,
  hasWishlistShareLink,
  listActiveWishlistShareLinks,
  createWishlistShareLink,
  revokeWishlistShareLink
} from '../app/lib/db/shared-wishlists';
import {
  claimWishlistItem,
  createWishlistItem,
  listFamilyWishlists,
  setOwnClaimState,
  type ItemInput
} from '../app/lib/db/wishlists';
import { inviteAndProvisionMember } from './family-fixtures';

function itemInput(overrides: Partial<ItemInput> = {}): ItemInput {
  return {
    title: 'A thoughtful present',
    notes: '',
    productUrl: '',
    imageUrl: '',
    price: '',
    priority: 'normal',
    ...overrides
  };
}

async function createMember(email: string): Promise<MemberWithWishlist> {
  const existingAdmin = await env.DB.prepare(
    `SELECT email FROM members WHERE role = 'admin' LIMIT 1`
  ).first<{ email: string }>();
  if (!existingAdmin) return ensureMemberForEmail(env.DB, email, email);
  const admin = await ensureMemberForEmail(env.DB, existingAdmin.email);
  return inviteAndProvisionMember(env.DB, admin, email);
}

describe('shared wishlists', () => {
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

  it('creates a high-entropy link while storing only its hash', async () => {
    const member = await createMember('owner@example.com');
    const token = await createWishlistShareLink(
      env.DB,
      member.id,
      member.wishlistId,
      '  Uncle   David  '
    );
    const stored = await env.DB.prepare(
      'SELECT name, token_hash FROM wishlist_share_links WHERE wishlist_id = ?1'
    )
      .bind(member.wishlistId)
      .first<{ name: string; token_hash: string }>();

    expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(stored?.name).toBe('Uncle David');
    expect(stored?.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored?.token_hash).not.toBe(token);
    await expect(hasWishlistShareLink(env.DB, member.wishlistId)).resolves.toBe(true);
  });

  it('keeps multiple links active and revokes them independently', async () => {
    const member = await createMember('owner@example.com');
    const oldToken = await createWishlistShareLink(env.DB, member.id, member.wishlistId, 'Grandad');
    const newToken = await createWishlistShareLink(
      env.DB,
      member.id,
      member.wishlistId,
      'Auntie Jo'
    );

    await expect(getSharedWishlist(env.DB, oldToken)).resolves.toMatchObject({
      ownerDisplayName: 'owner'
    });
    await expect(getSharedWishlist(env.DB, newToken)).resolves.toMatchObject({
      ownerDisplayName: 'owner'
    });

    const links = await listActiveWishlistShareLinks(env.DB, member.id);
    const linkToRevoke = links[0];
    if (!linkToRevoke) throw new Error('Expected an active viewing link.');
    await revokeWishlistShareLink(env.DB, member.id, linkToRevoke.id);
    const remaining = await Promise.all([
      getSharedWishlist(env.DB, oldToken),
      getSharedWishlist(env.DB, newToken)
    ]);
    expect(remaining.filter(Boolean)).toHaveLength(1);
    await expect(hasWishlistShareLink(env.DB, member.wishlistId)).resolves.toBe(true);
  });

  it('atomically caps the household at five active viewing links', async () => {
    const member = await createMember('owner@example.com');
    const attempts = await Promise.allSettled(
      Array.from({ length: 6 }, (_, index) =>
        createWishlistShareLink(env.DB, member.id, member.wishlistId, `Relative ${index + 1}`)
      )
    );

    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(5);
    const rejected = attempts.filter((attempt) => attempt.status === 'rejected');
    expect(rejected).toHaveLength(1);
    const rejectionReason: unknown = rejected[0]?.reason;
    expect(rejectionReason).toBeInstanceOf(Error);
    if (!(rejectionReason instanceof Error)) throw new Error('Expected link creation to fail.');
    expect(rejectionReason.message).toContain('five sharing links');
    await expect(listActiveWishlistShareLinks(env.DB, member.id)).resolves.toHaveLength(5);
  });

  it('lists every active family viewing link for persistent management', async () => {
    const alice = await createMember('alice@example.com');
    const bob = await createMember('bob@example.com');
    await createWishlistShareLink(env.DB, bob.id, alice.wishlistId, 'Alice’s neighbours');
    await createWishlistShareLink(env.DB, alice.id, bob.wishlistId, 'Bob’s school friends');

    const links = await listActiveWishlistShareLinks(env.DB, alice.id);
    expect(links).toHaveLength(2);
    expect(links[0]).toMatchObject({
      name: 'Alice’s neighbours',
      wishlistId: alice.wishlistId,
      ownerDisplayName: 'alice',
      createdByDisplayName: 'bob'
    });
    expect(links[1]).toMatchObject({
      name: 'Bob’s school friends',
      wishlistId: bob.wishlistId,
      ownerDisplayName: 'bob',
      createdByDisplayName: 'alice'
    });
    for (const link of links) {
      expect(link.id).toMatch(/^[0-9a-f-]{36}$/i);
      expect(Number.isNaN(Date.parse(link.createdAt))).toBe(false);
    }

    const bobLink = links.find((link) => link.wishlistId === bob.wishlistId);
    if (!bobLink) throw new Error('Expected Bob’s viewing link.');
    await revokeWishlistShareLink(env.DB, alice.id, bobLink.id);
    const remainingLinks = await listActiveWishlistShareLinks(env.DB, bob.id);
    expect(remainingLinks).toHaveLength(1);
    expect(remainingLinks[0]).toMatchObject({
      name: 'Alice’s neighbours',
      wishlistId: alice.wishlistId,
      ownerDisplayName: 'alice',
      createdByDisplayName: 'bob'
    });
  });

  it('does not list family sharing links for a disabled member', async () => {
    const member = await createMember('disabled@example.com');
    await createWishlistShareLink(env.DB, member.id, member.wishlistId, 'Old friend');
    await env.DB.prepare('UPDATE members SET disabled_at = ?1 WHERE id = ?2')
      .bind(new Date().toISOString(), member.id)
      .run();

    await expect(listActiveWishlistShareLinks(env.DB, member.id)).resolves.toEqual([]);
    await expect(listActiveWishlistShareLinks(env.DB, 'not-a-member')).rejects.toThrow(
      'signed-in member is invalid'
    );
  });

  it('returns wish details without ever querying or serialising claims', async () => {
    const owner = await createMember('owner@example.com');
    const giver = await createMember('giver@example.com');
    await createWishlistItem(
      env.DB,
      owner.id,
      owner.wishlistId,
      itemInput({
        title: 'Surprise',
        notes: 'The green one',
        productUrl: 'https://example.com/gift',
        imageUrl: 'https://cdn.example.com/gift.webp',
        price: '24.50',
        priority: 'high'
      })
    );
    const itemId = (await listFamilyWishlists(env.DB, giver.id)).find(
      (wishlist) => wishlist.id === owner.wishlistId
    )?.items[0]?.id;
    expect(itemId).toBeTruthy();
    await claimWishlistItem(env.DB, giver.id, itemId!);
    await setOwnClaimState(env.DB, giver.id, itemId!, 'purchased');

    const token = await createWishlistShareLink(
      env.DB,
      owner.id,
      owner.wishlistId,
      'Family friend'
    );
    const shared = await getSharedWishlist(env.DB, token);
    expect(shared?.items[0]).toEqual({
      id: itemId,
      title: 'Surprise',
      reservation: 'reserved',
      notes: 'The green one',
      productUrl: 'https://example.com/gift',
      imageUrl: 'https://cdn.example.com/gift.webp',
      priceAmountMinor: 2450,
      priceCurrency: 'GBP',
      priority: 'high'
    });
    expect(JSON.stringify(shared)).not.toContain('claim');
    expect(JSON.stringify(shared)).not.toContain('purchased');
    expect(JSON.stringify(shared)).not.toContain(giver.id);
  });

  it('reveals an image URL only for an item belonging to that shared list', async () => {
    const first = await createMember('first@example.com');
    const second = await createMember('second@example.com');
    await createWishlistItem(
      env.DB,
      first.id,
      first.wishlistId,
      itemInput({ imageUrl: 'https://cdn.example.com/first.webp' })
    );
    await createWishlistItem(
      env.DB,
      second.id,
      second.wishlistId,
      itemInput({ imageUrl: 'https://cdn.example.com/second.webp' })
    );
    const family = await listFamilyWishlists(env.DB, first.id);
    const firstItem = family.find((wishlist) => wishlist.id === first.wishlistId)?.items[0]?.id;
    const secondItem = family.find((wishlist) => wishlist.id === second.wishlistId)?.items[0]?.id;
    const token = await createWishlistShareLink(env.DB, first.id, first.wishlistId, 'Neighbour');

    const shared = await getSharedWishlist(env.DB, token);
    expect(shared?.items).toMatchObject([
      { id: firstItem, imageUrl: 'https://cdn.example.com/first.webp' }
    ]);
    expect(shared?.items.map((item) => item.id)).not.toContain(secondItem);
  });

  it.each([
    'http://cdn.example.com/gift.jpg',
    'https://127.0.0.1/gift.jpg',
    'https://user:secret@cdn.example.com/gift.jpg',
    'data:image/png;base64,AAAA'
  ])('omits unsafe stored pictures from both family and shared reads: %s', async (imageUrl) => {
    const member = await createMember('owner@example.com');
    await createWishlistItem(env.DB, member.id, member.wishlistId, itemInput());
    await env.DB.prepare('UPDATE items SET image_url = ?1 WHERE wishlist_id = ?2')
      .bind(imageUrl, member.wishlistId)
      .run();
    const token = await createWishlistShareLink(env.DB, member.id, member.wishlistId, 'Friends');
    expect((await listFamilyWishlists(env.DB, member.id))[0].items[0].imageUrl).toBeNull();
    expect((await getSharedWishlist(env.DB, token))?.items[0].imageUrl).toBeNull();
  });

  it('rejects malformed tokens and identifiers before database access', async () => {
    const member = await createMember('owner@example.com');
    await expect(getSharedWishlist(env.DB, 'short')).rejects.toThrow('sharing link is invalid');
    await expect(
      createWishlistShareLink(env.DB, 'not-a-member', member.wishlistId, 'Friend')
    ).rejects.toThrow('signed-in member is invalid');
    await expect(
      createWishlistShareLink(env.DB, member.id, member.wishlistId, '   ')
    ).rejects.toThrow('Give this sharing link a name');
    await expect(
      createWishlistShareLink(env.DB, member.id, member.wishlistId, 'x'.repeat(81))
    ).rejects.toThrow('80 characters or fewer');
  });
});
