import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { ensureMemberForEmail, type MemberWithWishlist } from '../app/lib/db/members';
import {
  claimWishlistItem,
  createWishlistItem,
  createWishlistItems,
  deleteWishlistItem,
  listFamilyWishlists,
  setOwnClaimState,
  unclaimWishlistItem,
  updateWishlistItem,
  type ItemInput
} from '../app/lib/db/wishlists';

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
  return ensureMemberForEmail(env.DB, email);
}

describe('wishlist service', () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM claims'),
      env.DB.prepare('DELETE FROM items'),
      env.DB.prepare('DELETE FROM wishlists'),
      env.DB.prepare('DELETE FROM members')
    ]);
  });

  it.each([
    [{ title: '' }, 'wish a name'],
    [{ title: 'x'.repeat(161) }, 'wish a name'],
    [{ notes: 'x'.repeat(2001) }, 'extra details'],
    [{ productUrl: 'javascript:alert(1)' }, 'link doesn’t look right'],
    [{ productUrl: 'https://user:secret@example.com/gift' }, 'link doesn’t look right'],
    [{ imageUrl: 'http://example.com/gift.jpg' }, 'picture link doesn’t look right'],
    [{ imageUrl: 'https://127.0.0.1/gift.jpg' }, 'picture link doesn’t look right'],
    [{ imageUrl: 'https://user:secret@example.com/gift.jpg' }, 'picture link doesn’t look right'],
    [{ price: '-1' }, 'pounds and pence'],
    [{ price: '12.345' }, 'pounds and pence'],
    [{ price: '10000000' }, 'pounds and pence'],
    [{ priority: 'urgent' }, 'options shown']
  ])('rejects invalid item input: %o', async (overrides, message) => {
    const member = await createMember('owner@example.com');

    await expect(
      createWishlistItem(env.DB, member.id, member.wishlistId, itemInput(overrides))
    ).rejects.toThrow(message);
  });

  it('rejects malformed resource identifiers before querying', async () => {
    const member = await createMember('owner@example.com');

    await expect(
      createWishlistItem(env.DB, member.id, 'not-a-wishlist', itemInput())
    ).rejects.toThrow('wishlist is invalid');
    await expect(deleteWishlistItem(env.DB, '1')).rejects.toThrow('item is invalid');
  });

  it('creates, normalises, updates and deletes an item', async () => {
    const member = await createMember('owner@example.com');
    await createWishlistItem(
      env.DB,
      member.id,
      member.wishlistId,
      itemInput({
        title: '  Red scarf  ',
        notes: '  Warm, not itchy  ',
        productUrl: ' https://example.com/scarf?q=red ',
        imageUrl: ' https://cdn.example.com/scarf-large.webp ',
        price: '24.5',
        priority: 'high'
      })
    );

    let view = await listFamilyWishlists(env.DB, member.id);
    expect(view).toHaveLength(1);
    expect(view[0]?.isOwn).toBe(true);
    expect(view[0]?.items[0]).toMatchObject({
      title: 'Red scarf',
      notes: 'Warm, not itchy',
      productUrl: 'https://example.com/scarf?q=red',
      imageUrl: 'https://cdn.example.com/scarf-large.webp',
      priceAmountMinor: 2450,
      priceCurrency: 'GBP',
      priority: 'high',
      position: 0,
      claimVisibility: 'hidden'
    });

    const itemId = view[0]?.items[0]?.id;
    expect(itemId).toBeTruthy();
    await updateWishlistItem(
      env.DB,
      itemId,
      itemInput({ title: 'Blue scarf', price: '0', priority: 'low' })
    );

    view = await listFamilyWishlists(env.DB, member.id);
    expect(view[0]?.items[0]).toMatchObject({
      title: 'Blue scarf',
      imageUrl: null,
      priceAmountMinor: 0,
      priceCurrency: 'GBP',
      priority: 'low'
    });

    await deleteWishlistItem(env.DB, itemId);
    view = await listFamilyWishlists(env.DB, member.id);
    expect(view[0]?.items).toEqual([]);
  });

  it('adds the same wish to several selected family lists', async () => {
    const alex = await createMember('alex@example.com');
    const robin = await createMember('robin@example.com');

    await createWishlistItems(
      env.DB,
      alex.id,
      [alex.wishlistId, robin.wishlistId, robin.wishlistId],
      itemInput({
        title: 'Board game',
        productUrl: 'https://example.com/game',
        imageUrl: 'https://cdn.example.com/game.webp'
      })
    );

    const view = await listFamilyWishlists(env.DB, alex.id);
    expect(view).toHaveLength(2);
    expect(view.map((wishlist) => wishlist.items.map((item) => item.title))).toEqual([
      ['Board game'],
      ['Board game']
    ]);
    expect(view.every((wishlist) => wishlist.items[0]?.imageUrl?.endsWith('/game.webp'))).toBe(
      true
    );
    expect(view[0]?.items[0]?.id).not.toBe(view[1]?.items[0]?.id);
  });

  it('adds nothing when any selected family list no longer exists', async () => {
    const alex = await createMember('alex@example.com');
    const robin = await createMember('robin@example.com');
    const missingWishlistId = crypto.randomUUID();

    await expect(
      createWishlistItems(
        env.DB,
        alex.id,
        [alex.wishlistId, missingWishlistId, robin.wishlistId],
        itemInput({ title: 'Shared idea' })
      )
    ).rejects.toThrow('find every wishlist');

    const view = await listFamilyWishlists(env.DB, alex.id);
    expect(view.every((wishlist) => wishlist.items.length === 0)).toBe(true);
  });

  it('requires at least one list and limits bookmarklet bulk adds', async () => {
    const member = await createMember('owner@example.com');

    await expect(createWishlistItems(env.DB, member.id, [], itemInput())).rejects.toThrow(
      'at least one wishlist'
    );
    await expect(
      createWishlistItems(
        env.DB,
        member.id,
        Array.from({ length: 51 }, () => crypto.randomUUID()),
        itemInput()
      )
    ).rejects.toThrow('up to 50 wishlists');
  });

  it('shows every family wishlist with the viewer first', async () => {
    const alex = await createMember('alex@example.com');
    const robin = await createMember('robin@example.com');

    const view = await listFamilyWishlists(env.DB, robin.id);

    expect(view.map((wishlist) => wishlist.owner.id)).toEqual([robin.id, alex.id]);
    expect(view.map((wishlist) => wishlist.isOwn)).toEqual([true, false]);
  });

  it('hides claim and purchase data from the wishlist owner at the query boundary', async () => {
    const owner = await createMember('owner@example.com');
    const giver = await createMember('giver@example.com');
    await createWishlistItem(env.DB, owner.id, owner.wishlistId, itemInput({ title: 'Surprise' }));

    const giverView = await listFamilyWishlists(env.DB, giver.id);
    const itemId = giverView.find((wishlist) => wishlist.owner.id === owner.id)?.items[0]?.id;
    expect(itemId).toBeTruthy();

    await claimWishlistItem(env.DB, giver.id, itemId!);
    await setOwnClaimState(env.DB, giver.id, itemId!, 'purchased');

    const ownerView = await listFamilyWishlists(env.DB, owner.id);
    const ownerItem = ownerView[0]?.items[0];
    expect(ownerItem).toMatchObject({ title: 'Surprise', claimVisibility: 'hidden' });
    expect(ownerItem).not.toHaveProperty('claim');
    expect(JSON.stringify(ownerItem)).not.toContain('purchased');
    expect(JSON.stringify(ownerItem)).not.toContain(giver.id);

    const visibleToGiver = await listFamilyWishlists(env.DB, giver.id);
    const claimedItem = visibleToGiver.find((wishlist) => wishlist.owner.id === owner.id)?.items[0];
    expect(claimedItem).toMatchObject({
      claimVisibility: 'visible',
      claim: {
        state: 'purchased',
        claimedByMemberId: giver.id,
        claimedByDisplayName: 'giver',
        isClaimedByViewer: true
      }
    });
  });

  it('prevents owners, competing gift-givers and non-claimants changing a claim', async () => {
    const owner = await createMember('owner@example.com');
    const firstGiver = await createMember('first@example.com');
    const secondGiver = await createMember('second@example.com');
    await createWishlistItem(env.DB, owner.id, owner.wishlistId, itemInput());
    const itemId = (await listFamilyWishlists(env.DB, firstGiver.id)).find(
      (wishlist) => wishlist.owner.id === owner.id
    )?.items[0]?.id;
    expect(itemId).toBeTruthy();

    await expect(claimWishlistItem(env.DB, owner.id, itemId!)).rejects.toThrow('own wishlist');
    await claimWishlistItem(env.DB, firstGiver.id, itemId!);
    await expect(claimWishlistItem(env.DB, secondGiver.id, itemId!)).rejects.toThrow('already');
    await expect(setOwnClaimState(env.DB, secondGiver.id, itemId!, 'purchased')).rejects.toThrow(
      'person getting this gift'
    );
    await expect(unclaimWishlistItem(env.DB, secondGiver.id, itemId!)).rejects.toThrow(
      'person getting this gift'
    );

    await unclaimWishlistItem(env.DB, firstGiver.id, itemId!);
    await claimWishlistItem(env.DB, secondGiver.id, itemId!);

    const secondView = await listFamilyWishlists(env.DB, secondGiver.id);
    expect(secondView.find((wishlist) => wishlist.owner.id === owner.id)?.items[0]).toMatchObject({
      claim: { claimedByMemberId: secondGiver.id }
    });
  });
});
