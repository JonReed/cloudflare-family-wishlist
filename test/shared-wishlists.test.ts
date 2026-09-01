import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { ensureMemberForEmail, type MemberWithWishlist } from '../app/lib/db/members';
import {
  consumeSharedImageBudget,
  getSharedWishlist,
  getSharedWishlistImageUrl,
  hasWishlistShareLink,
  makeSharedImageRequesterKey,
  replaceWishlistShareLink,
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
    const token = await replaceWishlistShareLink(env.DB, member.id, member.wishlistId);
    const stored = await env.DB.prepare(
      'SELECT token_hash FROM wishlist_share_links WHERE wishlist_id = ?1'
    )
      .bind(member.wishlistId)
      .first<{ token_hash: string }>();

    expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(stored?.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored?.token_hash).not.toBe(token);
    await expect(hasWishlistShareLink(env.DB, member.wishlistId)).resolves.toBe(true);
  });

  it('replaces and revokes links immediately', async () => {
    const member = await createMember('owner@example.com');
    const oldToken = await replaceWishlistShareLink(env.DB, member.id, member.wishlistId);
    const newToken = await replaceWishlistShareLink(env.DB, member.id, member.wishlistId);

    await expect(getSharedWishlist(env.DB, oldToken)).resolves.toBeNull();
    await expect(getSharedWishlist(env.DB, newToken)).resolves.toMatchObject({
      ownerDisplayName: 'owner'
    });

    await revokeWishlistShareLink(env.DB, member.id, member.wishlistId);
    await expect(getSharedWishlist(env.DB, newToken)).resolves.toBeNull();
    await expect(hasWishlistShareLink(env.DB, member.wishlistId)).resolves.toBe(false);
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

    const token = await replaceWishlistShareLink(env.DB, owner.id, owner.wishlistId);
    const shared = await getSharedWishlist(env.DB, token);
    expect(shared?.items[0]).toEqual({
      id: itemId,
      title: 'Surprise',
      notes: 'The green one',
      productUrl: 'https://example.com/gift',
      hasImage: true,
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
    const token = await replaceWishlistShareLink(env.DB, first.id, first.wishlistId);

    await expect(getSharedWishlistImageUrl(env.DB, token, firstItem)).resolves.toMatchObject({
      imageUrl: 'https://cdn.example.com/first.webp'
    });
    await expect(getSharedWishlistImageUrl(env.DB, token, secondItem)).resolves.toBeNull();
  });

  it('derives requester keys without storing reusable network identifiers', async () => {
    const firstToken = 'a'.repeat(22);
    const secondToken = 'b'.repeat(22);
    const first = await makeSharedImageRequesterKey(firstToken, '203.0.113.8');

    expect(first).toMatch(/^[0-9a-f]{64}$/);
    await expect(makeSharedImageRequesterKey(firstToken, '203.0.113.8')).resolves.toBe(first);
    await expect(makeSharedImageRequesterKey(firstToken, '203.0.113.9')).resolves.not.toBe(first);
    await expect(makeSharedImageRequesterKey(secondToken, '203.0.113.8')).resolves.not.toBe(first);
    expect(first).not.toContain('203.0.113.8');
  });

  it('atomically bounds concurrent public image fetching per requester', async () => {
    const member = await createMember('owner@example.com');
    const now = Date.UTC(2026, 8, 1, 12, 34, 20);
    const requesterHash = 'a'.repeat(64);
    const attempts = await Promise.allSettled(
      Array.from({ length: 21 }, () =>
        consumeSharedImageBudget(env.DB, member.wishlistId, requesterHash, now)
      )
    );

    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(20);
    expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(1);
    await expect(
      consumeSharedImageBudget(env.DB, member.wishlistId, requesterHash, now + 60_000)
    ).resolves.toBeUndefined();
  });

  it('atomically retains the higher list-wide emergency ceiling', async () => {
    const member = await createMember('owner@example.com');
    const now = Date.UTC(2026, 8, 1, 12, 34, 20);
    const attempts = await Promise.allSettled(
      Array.from({ length: 61 }, (_, index) =>
        consumeSharedImageBudget(
          env.DB,
          member.wishlistId,
          index.toString(16).padStart(64, '0'),
          now
        )
      )
    );

    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(60);
    expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(1);
  });

  it('enforces the list-wide daily ceiling and reports its rollover', async () => {
    const member = await createMember('owner@example.com');
    const now = Date.UTC(2026, 8, 1, 23, 59, 20);
    const nowSeconds = Math.floor(now / 1000);
    const minuteStartedAt = nowSeconds - (nowSeconds % 60);
    const dayStartedAt = nowSeconds - (nowSeconds % 86_400);
    await env.DB.prepare(
      `INSERT INTO shared_image_requester_limits (
         wishlist_id, requester_hash, minute_started_at, minute_request_count,
         day_started_at, day_request_count
       ) VALUES (?1, ?2, ?3, 1, ?4, 1)`
    )
      .bind(member.wishlistId, 'f'.repeat(64), minuteStartedAt - 86_400, dayStartedAt - 86_400)
      .run();
    await env.DB.prepare(
      `INSERT INTO shared_image_fetch_limits (
         wishlist_id, minute_started_at, minute_request_count, day_started_at, day_request_count
       ) VALUES (?1, ?2, 1, ?3, 499)`
    )
      .bind(member.wishlistId, minuteStartedAt, dayStartedAt)
      .run();

    await expect(
      consumeSharedImageBudget(env.DB, member.wishlistId, 'a'.repeat(64), now)
    ).resolves.toBeUndefined();
    await expect(
      consumeSharedImageBudget(env.DB, member.wishlistId, 'b'.repeat(64), now)
    ).rejects.toMatchObject({ retryAfterSeconds: 40 });
    await expect(
      env.DB.prepare('SELECT 1 FROM shared_image_requester_limits WHERE requester_hash = ?1')
        .bind('f'.repeat(64))
        .first()
    ).resolves.toBeNull();
  });

  it('rejects malformed tokens and identifiers before database access', async () => {
    const member = await createMember('owner@example.com');
    await expect(getSharedWishlist(env.DB, 'short')).rejects.toThrow('sharing link is invalid');
    await expect(
      replaceWishlistShareLink(env.DB, 'not-a-member', member.wishlistId)
    ).rejects.toThrow('signed-in member is invalid');
  });
});
