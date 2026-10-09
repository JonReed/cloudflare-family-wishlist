import { createExecutionContext } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it } from 'vitest';

import { cloudflareContext } from '../app/lib/context';
import { ensureMemberForEmail } from '../app/lib/db/members';
import {
  createFamilyShareLink,
  createWishlistShareLink,
  getSharedWishlists,
  getSharedWishlistImageUrl,
  listActiveFamilyShareLinks,
  listActiveShareLinks,
  listShareableWishlists,
  revokeFamilyShareLink,
  revokeShareLink
} from '../app/lib/db/shared-wishlists';
import {
  claimWishlistItem,
  createWishlistItem,
  listFamilyWishlists,
  setOwnClaimState
} from '../app/lib/db/wishlists';
import SharedWishlistPage from '../app/routes/shared-wishlist';
import { createAppWorker } from '../workers/app';
import { inviteAndProvisionMember } from './family-fixtures';

async function fixture() {
  const admin = await ensureMemberForEmail(env.DB, 'alice@example.com', 'alice@example.com');
  const bob = await inviteAndProvisionMember(env.DB, admin, 'bob@example.com');
  const carol = await inviteAndProvisionMember(env.DB, admin, 'carol@example.com');
  return { admin, bob, carol };
}

describe('family sharing', () => {
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

  it('shares only selected lists, keeps empty lists, and stores a hash and private name', async () => {
    const { admin, bob, carol } = await fixture();
    const { token, shareLinkId } = await createFamilyShareLink(
      env.DB,
      admin.id,
      [bob.wishlistId, admin.wishlistId, bob.wishlistId],
      '  Uncle   David  '
    );
    const shared = await getSharedWishlists(env.DB, token);
    expect(shared.map((list) => list.id)).toEqual([admin.wishlistId, bob.wishlistId]);
    expect(shared.every((list) => list.items.length === 0)).toBe(true);
    expect(shared.map((list) => list.id)).not.toContain(carol.wishlistId);
    const laterMember = await inviteAndProvisionMember(env.DB, admin, 'later@example.com');
    await createWishlistItem(env.DB, admin.id, bob.wishlistId, {
      title: 'Added after sharing',
      notes: '',
      productUrl: '',
      imageUrl: '',
      price: '',
      priority: 'normal'
    });
    const updated = await getSharedWishlists(env.DB, token);
    expect(updated.find((list) => list.id === bob.wishlistId)?.items[0]?.title).toBe(
      'Added after sharing'
    );
    expect(updated.map((list) => list.id)).not.toContain(laterMember.wishlistId);
    const stored = await env.DB.prepare(
      'SELECT name, token_hash FROM family_share_links WHERE id = ?1'
    )
      .bind(shareLinkId)
      .first<{ name: string; token_hash: string }>();
    expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(stored?.name).toBe('Uncle David');
    expect(stored?.token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(stored?.token_hash).not.toBe(token);
    expect(JSON.stringify(shared)).not.toContain('Uncle David');
    expect(await listActiveFamilyShareLinks(env.DB, admin.id)).toMatchObject([
      {
        id: shareLinkId,
        name: 'Uncle David',
        wishlists: [
          { id: admin.wishlistId, ownerDisplayName: 'alice' },
          { id: bob.wishlistId, ownerDisplayName: 'bob' }
        ]
      }
    ]);
  });

  it('publishes availability without private claim details and scopes images to selected lists', async () => {
    const { admin, bob, carol } = await fixture();
    for (const member of [admin, bob, carol]) {
      await createWishlistItem(env.DB, admin.id, member.wishlistId, {
        title: `Gift for ${member.displayName}`,
        notes: 'Green please',
        productUrl: 'https://example.com/gift',
        imageUrl: 'https://cdn.example.com/gift.webp',
        price: '24.50',
        priority: 'high'
      });
    }
    const lists = await listFamilyWishlists(env.DB, bob.id);
    const aliceItem = lists.find((list) => list.id === admin.wishlistId)?.items[0];
    const bobItem = lists.find((list) => list.id === bob.wishlistId)?.items[0];
    const carolItem = lists.find((list) => list.id === carol.wishlistId)?.items[0];
    if (!aliceItem || !bobItem || !carolItem) throw new Error('Missing fixture items');
    await claimWishlistItem(env.DB, bob.id, aliceItem.id);
    await setOwnClaimState(env.DB, bob.id, aliceItem.id, 'purchased');
    const { token } = await createFamilyShareLink(
      env.DB,
      admin.id,
      [admin.wishlistId, bob.wishlistId],
      'Private reminder'
    );
    const shared = await getSharedWishlists(env.DB, token);
    expect(shared[0]?.items[0]).toMatchObject({
      title: 'Gift for alice',
      notes: 'Green please',
      priceAmountMinor: 2450
    });
    for (const item of [aliceItem, bobItem]) {
      expect(await getSharedWishlistImageUrl(env.DB, token, item.id)).toMatchObject({
        imageUrl: 'https://cdn.example.com/gift.webp'
      });
    }
    await expect(getSharedWishlistImageUrl(env.DB, token, carolItem.id)).resolves.toBeNull();
    const loaderData = { wishlists: shared, token, recoveryCode: 'a'.repeat(43) };
    const html = renderToStaticMarkup(
      <SharedWishlistPage
        loaderData={loaderData}
        params={{ token }}
        matches={[
          {
            id: 'root',
            params: {},
            pathname: '/',
            loaderData: { cspNonce: 'test', isPublicShare: true },
            handle: undefined
          },
          {
            id: 'routes/shared-wishlist',
            params: { token },
            pathname: `/shared/${token}`,
            loaderData,
            handle: undefined
          }
        ]}
      />
    );
    for (const privateValue of [
      'purchased',
      'claimed_by_member_id',
      bob.id,
      'Private reminder',
      'Gift for carol'
    ]) {
      expect(JSON.stringify(shared)).not.toContain(privateValue);
      expect(html).not.toContain(privateValue);
    }
    expect(html).toContain('alice’s wishlist');
    expect(html).toContain('bob’s wishlist');
    expect(shared[0]?.items[0]?.reservation).toBe('reserved');
    expect(shared[1]?.items[0]?.reservation).toBe('available');
    expect(html).toContain('I’ll get this');
    expect(html).toContain('method="post"');
  });

  it('rejects invalid or stale selections without persisting a partial link', async () => {
    const { admin } = await fixture();
    for (const ids of [
      [],
      ['invalid'],
      [admin.wishlistId, crypto.randomUUID()],
      Array.from({ length: 51 }, () => admin.wishlistId)
    ]) {
      await expect(createFamilyShareLink(env.DB, admin.id, ids, 'Friends')).rejects.toThrow();
    }
    for (const name of ['', 'x'.repeat(81)]) {
      await expect(
        createFamilyShareLink(env.DB, admin.id, [admin.wishlistId], name)
      ).rejects.toThrow();
    }
    expect(await listActiveFamilyShareLinks(env.DB, admin.id)).toEqual([]);
    expect(
      await env.DB.prepare('SELECT COUNT(*) AS count FROM family_share_link_wishlists').first()
    ).toEqual({ count: 0 });
  });

  it('lets active members manage all links while denying disabled members', async () => {
    const { admin, bob, carol } = await fixture();
    const created = await createFamilyShareLink(env.DB, bob.id, [carol.wishlistId], 'Grandad');
    await expect(listShareableWishlists(env.DB, bob.id)).resolves.toHaveLength(3);
    await expect(listActiveShareLinks(env.DB, bob.id)).resolves.toHaveLength(1);
    await env.DB.prepare('UPDATE members SET disabled_at = ?1 WHERE id = ?2')
      .bind(new Date().toISOString(), bob.id)
      .run();
    await expect(
      createFamilyShareLink(env.DB, bob.id, [carol.wishlistId], 'Friends')
    ).rejects.toThrow();
    await expect(listActiveShareLinks(env.DB, bob.id)).resolves.toEqual([]);
    await expect(listShareableWishlists(env.DB, bob.id)).resolves.toEqual([]);
    await revokeShareLink(env.DB, bob.id, created.shareLinkId);
    await expect(getSharedWishlists(env.DB, created.token)).resolves.toHaveLength(1);
    await revokeShareLink(env.DB, admin.id, created.shareLinkId);
    await expect(getSharedWishlists(env.DB, created.token)).resolves.toEqual([]);
  });

  it('atomically caps mixed single-list and group creation at five household links', async () => {
    const { admin, bob } = await fixture();
    const attempts = await Promise.allSettled(
      Array.from({ length: 8 }, (_, index) =>
        index % 2
          ? createWishlistShareLink(env.DB, bob.id, bob.wishlistId, `Friend ${index}`)
          : createFamilyShareLink(
              env.DB,
              admin.id,
              [admin.wishlistId, bob.wishlistId],
              `Group ${index}`
            )
      )
    );
    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(5);
    expect(attempts.filter((attempt) => attempt.status === 'rejected')).toHaveLength(3);
    const links = await listActiveShareLinks(env.DB, bob.id);
    expect(links).toHaveLength(5);
    const first = links[0];
    if (!first) throw new Error('Missing link');
    await revokeShareLink(env.DB, bob.id, first.id);
    await createFamilyShareLink(env.DB, bob.id, [bob.wishlistId], 'Replacement');
    await expect(listActiveShareLinks(env.DB, admin.id)).resolves.toHaveLength(5);
  });

  it('shows legacy and new links together with exactly their currently visible lists', async () => {
    const { admin, bob } = await fixture();
    const oldToken = await createWishlistShareLink(env.DB, admin.id, bob.wishlistId, 'Old friend');
    const group = await createFamilyShareLink(
      env.DB,
      bob.id,
      [admin.wishlistId, bob.wishlistId],
      'Relatives'
    );
    const links = await listActiveShareLinks(env.DB, bob.id);
    expect(links.map((link) => link.name).sort()).toEqual(['Old friend', 'Relatives']);
    expect(links.find((link) => link.name === 'Old friend')?.wishlists).toEqual([
      { id: bob.wishlistId, ownerDisplayName: 'bob' }
    ]);
    await env.DB.prepare('UPDATE members SET disabled_at = ?1 WHERE id = ?2')
      .bind(new Date().toISOString(), bob.id)
      .run();
    const visible = await listActiveShareLinks(env.DB, admin.id);
    expect(visible.find((link) => link.name === 'Old friend')?.wishlists).toEqual([]);
    expect(visible.find((link) => link.name === 'Relatives')?.wishlists).toEqual([
      { id: admin.wishlistId, ownerDisplayName: 'alice' }
    ]);
    const oldLink = visible.find((link) => link.name === 'Old friend');
    if (!oldLink) throw new Error('Missing legacy link');
    await revokeShareLink(env.DB, admin.id, oldLink.id);
    await expect(getSharedWishlists(env.DB, oldToken)).resolves.toEqual([]);
    await expect(getSharedWishlists(env.DB, group.token)).resolves.toHaveLength(1);
  });

  it('keeps more than five older links usable and manageable until the household frees space', async () => {
    const { admin, bob } = await fixture();
    const olderLinks: { id: string; token: string }[] = [];
    // Before consolidation, each wishlist could have five links independently.
    for (let index = 0; index < 6; index++) {
      const id = crypto.randomUUID();
      const token = `${'A'.repeat(21)}${index}`;
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
      const hash = [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
      await env.DB.prepare(
        `INSERT INTO wishlist_share_links
        (id, wishlist_id, name, token_hash, created_by_member_id)
        VALUES (?1, ?2, ?3, ?4, ?5)`
      )
        .bind(id, index < 3 ? admin.wishlistId : bob.wishlistId, `Older ${index}`, hash, admin.id)
        .run();
      olderLinks.push({ id, token });
    }
    await expect(listActiveShareLinks(env.DB, bob.id)).resolves.toHaveLength(6);
    for (const link of olderLinks)
      await expect(getSharedWishlists(env.DB, link.token)).resolves.toHaveLength(1);
    await expect(
      createFamilyShareLink(env.DB, bob.id, [bob.wishlistId], 'New link')
    ).rejects.toThrow();
    const first = olderLinks[0];
    const second = olderLinks[1];
    if (!first || !second) throw new Error('Missing older links');
    await revokeShareLink(env.DB, bob.id, first.id);
    await expect(
      createFamilyShareLink(env.DB, bob.id, [bob.wishlistId], 'New link')
    ).rejects.toThrow();
    await revokeShareLink(env.DB, bob.id, second.id);
    await createFamilyShareLink(env.DB, bob.id, [bob.wishlistId], 'New link');
    await expect(listActiveShareLinks(env.DB, admin.id)).resolves.toHaveLength(5);
    await expect(getSharedWishlists(env.DB, first.token)).resolves.toEqual([]);
    for (const link of olderLinks.slice(2))
      await expect(getSharedWishlists(env.DB, link.token)).resolves.toHaveLength(1);
  });

  it('revokes a whole group and its images while other links remain usable through the Worker', async () => {
    const { admin, bob } = await fixture();
    await createWishlistItem(env.DB, admin.id, bob.wishlistId, {
      title: 'A picture gift',
      notes: '',
      productUrl: '',
      imageUrl: 'https://cdn.example.com/gift.webp',
      price: '',
      priority: 'normal'
    });
    const item = (await listFamilyWishlists(env.DB, admin.id)).find(
      (list) => list.id === bob.wishlistId
    )?.items[0];
    if (!item) throw new Error('Missing picture item');
    const first = await createFamilyShareLink(
      env.DB,
      admin.id,
      [admin.wishlistId, bob.wishlistId],
      'Grandad'
    );
    const second = await createFamilyShareLink(env.DB, admin.id, [bob.wishlistId], 'Neighbour');
    const singleToken = await createWishlistShareLink(env.DB, admin.id, admin.wishlistId, 'Friend');
    const worker = createAppWorker(async (request, context) => {
      const { env: runtimeEnv } = context.get(cloudflareContext);
      const lists = await getSharedWishlists(
        runtimeEnv.DB,
        new URL(request.url).pathname.split('/')[2]
      );
      return lists.length ? Response.json(lists) : new Response('Not found', { status: 404 });
    });
    const fetch = worker.fetch;
    if (!fetch) throw new Error('Missing Worker handler');
    const request = new Request(`https://wishlist.example/shared/${first.token}`) as Parameters<
      typeof fetch
    >[0];
    expect((await fetch(request, env, createExecutionContext())).status).toBe(200);
    await expect(getSharedWishlistImageUrl(env.DB, first.token, item.id)).resolves.toMatchObject({
      imageUrl: 'https://cdn.example.com/gift.webp'
    });
    await revokeFamilyShareLink(env.DB, admin.id, first.shareLinkId);
    await revokeFamilyShareLink(env.DB, admin.id, first.shareLinkId);
    expect((await fetch(request, env, createExecutionContext())).status).toBe(404);
    await expect(getSharedWishlistImageUrl(env.DB, first.token, item.id)).resolves.toBeNull();
    await expect(getSharedWishlistImageUrl(env.DB, second.token, item.id)).resolves.toMatchObject({
      imageUrl: 'https://cdn.example.com/gift.webp'
    });
    await expect(getSharedWishlists(env.DB, second.token)).resolves.toHaveLength(1);
    await expect(getSharedWishlists(env.DB, singleToken)).resolves.toHaveLength(1);
    expect(await listActiveFamilyShareLinks(env.DB, admin.id)).toHaveLength(1);
    expect(
      await env.DB.prepare(
        'SELECT COUNT(*) AS count FROM family_share_link_wishlists WHERE share_link_id = ?1'
      )
        .bind(first.shareLinkId)
        .first()
    ).toEqual({ count: 0 });
  });
});
