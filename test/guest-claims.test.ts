import { env } from 'cloudflare:workers';
import { createExecutionContext } from 'cloudflare:test';
import { RouterContextProvider } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { cloudflareContext } from '../app/lib/context';
import { ensureMemberForEmail } from '../app/lib/db/members';
import {
  createWishlistShareLink,
  createFamilyShareLink,
  revokeShareLink,
  getSharedWishlists,
  listActiveWishlistShareLinks
} from '../app/lib/db/shared-wishlists';
import {
  claimWishlistItem,
  createWishlistItem,
  listFamilyWishlists,
  releaseGuestClaim
} from '../app/lib/db/wishlists';
import { changeGuestClaim, consumeGuestClaimBudget } from '../app/lib/db/guest-claims';
import { action, loader } from '../app/routes/shared-wishlist';
import { inviteAndProvisionMember } from './family-fixtures';

const origin = 'https://wishlist.example';
async function fixture() {
  const owner = await ensureMemberForEmail(env.DB, 'owner@example.com', 'owner@example.com');
  const giver = await inviteAndProvisionMember(env.DB, owner, 'giver@example.com');
  await createWishlistItem(env.DB, owner.id, owner.wishlistId, {
    title: 'Guest gift',
    notes: '',
    productUrl: '',
    imageUrl: '',
    price: '',
    priority: 'normal'
  });
  const item = (await listFamilyWishlists(env.DB, owner.id))[0].items[0];
  const token = await createWishlistShareLink(env.DB, owner.id, owner.wishlistId, 'Uncle David');
  return { owner, giver, item, token };
}
function routeArgs(token: string) {
  const context = new RouterContextProvider();
  context.set(cloudflareContext, { env, ctx: createExecutionContext(), cspNonce: 'test-nonce' });
  return {
    params: { token },
    context,
    request: new Request(`${origin}/shared/${token}`),
    pattern: '/shared/:token',
    url: new URL(`${origin}/shared/${token}`)
  };
}
function request(token: string, intent: string, itemId = '', extra: Record<string, string> = {}) {
  return new Request(`${origin}/shared/${token}`, {
    method: 'POST',
    headers: { Origin: origin },
    body: new URLSearchParams({ intent, itemId, ...extra })
  });
}
async function reservation(token: string) {
  return (await getSharedWishlists(env.DB, token))[0].items[0].reservation;
}

describe('link-owned guest reservations', () => {
  beforeEach(async () => {
    await env.DB.batch(
      [
        'guest_claim_limits',
        'family_share_links',
        'wishlist_share_links',
        'claims',
        'items',
        'wishlists',
        'family_invitations',
        'members'
      ].map((table) => env.DB.prepare(`DELETE FROM ${table}`))
    );
  });

  it('uses the link name for family members while hiding all claims from the signed-in owner', async () => {
    const f = await fixture();
    await changeGuestClaim(env.DB, f.token, f.item.id, 'claim');
    expect(await reservation(f.token)).toBe('yours');
    const ownerItem = (await listFamilyWishlists(env.DB, f.owner.id)).find(
      (list) => list.id === f.owner.wishlistId
    )!.items[0];
    expect(ownerItem.claimVisibility).toBe('hidden');
    expect(ownerItem).not.toHaveProperty('claim');
    expect(JSON.stringify(ownerItem)).not.toContain('Uncle David');
    const giverItem = (await listFamilyWishlists(env.DB, f.giver.id)).find(
      (list) => list.id === f.owner.wishlistId
    )!.items[0];
    expect(giverItem).toMatchObject({
      claim: { claimedByDisplayName: 'Uncle David', isClaimedByViewer: false }
    });
    const publicJson = JSON.stringify(await getSharedWishlists(env.DB, f.token));
    expect(publicJson).not.toContain('Uncle David');
    expect(publicJson).not.toContain('guest_token_hash');
    expect(publicJson).not.toContain('share_link_name');
    await expect(claimWishlistItem(env.DB, f.giver.id, f.item.id)).rejects.toThrow();
  });

  it('shows and manages the same reservations from a fresh browser without cookies', async () => {
    const f = await fixture();
    const args = routeArgs(f.token);
    const claimed = await action({ ...args, request: request(f.token, 'claim', f.item.id) });
    expect(claimed).toBeInstanceOf(Response);
    if (!(claimed instanceof Response)) throw new Error('Expected redirect');
    expect(claimed.status).toBe(303);
    expect(claimed.headers.get('Location')).toBe(`/shared/${f.token}#wish-${f.item.id}`);
    expect(claimed.headers.has('Set-Cookie')).toBe(false);
    const freshBrowser = await loader(routeArgs(f.token));
    expect(freshBrowser.data.wishlists[0].items[0].reservation).toBe('yours');
    expect(freshBrowser.data).not.toHaveProperty('recoveryCode');
    expect(new Headers(freshBrowser.init?.headers).has('Set-Cookie')).toBe(false);
    for (const [intent, state] of [
      ['bought', 'bought'],
      ['unbought', 'yours'],
      ['release', 'available']
    ]) {
      const changed = await action({
        ...routeArgs(f.token),
        request: request(f.token, intent, f.item.id)
      });
      expect(changed).toBeInstanceOf(Response);
      if (!(changed instanceof Response)) throw new Error('Expected redirect');
      expect(changed.headers.has('Set-Cookie')).toBe(false);
      expect((await loader(routeArgs(f.token))).data.wishlists[0].items[0].reservation).toBe(state);
    }
  });

  it('isolates two named links to the same wishlist, including purchase state and posted credentials', async () => {
    const f = await fixture();
    const other = await createWishlistShareLink(
      env.DB,
      f.owner.id,
      f.owner.wishlistId,
      'Aunt Jane'
    );
    await changeGuestClaim(env.DB, f.token, f.item.id, 'claim');
    await changeGuestClaim(env.DB, f.token, f.item.id, 'bought');
    expect(await reservation(f.token)).toBe('bought');
    expect(await reservation(other)).toBe('reserved');
    for (const intent of ['claim', 'release', 'bought', 'unbought']) {
      const forged = request(other, intent, f.item.id, {
        token: f.token,
        share_link_name: 'Uncle David'
      });
      forged.headers.set('Cookie', '__Host-wishlist-guest=' + 'a'.repeat(43));
      expect(await action({ ...routeArgs(other), request: forged })).toMatchObject({
        init: { status: 409 }
      });
    }
    expect(await reservation(f.token)).toBe('bought');
  });

  it('permits exactly one winner across concurrent member and link requests', async () => {
    const f = await fixture();
    const results = await Promise.allSettled([
      changeGuestClaim(env.DB, f.token, f.item.id, 'claim'),
      claimWishlistItem(env.DB, f.giver.id, f.item.id)
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM claims').first()).toEqual({ n: 1 });
  });

  it('permits exactly one concurrent claim from different links and rejects repeat submissions', async () => {
    const f = await fixture();
    const other = await createWishlistShareLink(
      env.DB,
      f.owner.id,
      f.owner.wishlistId,
      'Aunt Jane'
    );
    const results = await Promise.allSettled(
      [f.token, other].map((token) => changeGuestClaim(env.DB, token, f.item.id, 'claim'))
    );
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const winner = results[0].status === 'fulfilled' ? f.token : other;
    await expect(changeGuestClaim(env.DB, winner, f.item.id, 'claim')).rejects.toThrow();
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM claims').first()).toEqual({ n: 1 });
  });

  it('checks selected lists, enabled owners and active links on every write, retaining names after revocation', async () => {
    const f = await fixture();
    const selected = await createFamilyShareLink(
      env.DB,
      f.owner.id,
      [f.owner.wishlistId, f.giver.wishlistId],
      'Grandparents'
    );
    const excluded = await createFamilyShareLink(
      env.DB,
      f.owner.id,
      [f.giver.wishlistId],
      'Other list'
    );
    await expect(changeGuestClaim(env.DB, excluded.token, f.item.id, 'claim')).rejects.toThrow();
    await changeGuestClaim(env.DB, selected.token, f.item.id, 'claim');
    await env.DB.prepare('UPDATE members SET disabled_at = ?1 WHERE id = ?2')
      .bind('2026-10-27', f.owner.id)
      .run();
    await expect(changeGuestClaim(env.DB, selected.token, f.item.id, 'bought')).rejects.toThrow();
    await env.DB.prepare('UPDATE members SET disabled_at = NULL WHERE id = ?1')
      .bind(f.owner.id)
      .run();
    await revokeShareLink(env.DB, f.owner.id, selected.shareLinkId);
    await expect(changeGuestClaim(env.DB, selected.token, f.item.id, 'release')).rejects.toThrow();
    await expect(changeGuestClaim(env.DB, f.token, f.item.id, 'release')).rejects.toThrow();
    expect(await reservation(f.token)).toBe('reserved');
    expect(
      (await listFamilyWishlists(env.DB, f.giver.id)).find(
        (list) => list.id === f.owner.wishlistId
      )!.items[0]
    ).toMatchObject({
      claim: { claimedByDisplayName: 'Grandparents' }
    });
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM claims').first()).toEqual({ n: 1 });
  });

  it('preserves old browser reservations without assigning them to an arbitrary link', async () => {
    const f = await fixture();
    // The previous Worker remains able to write after the additive migration.
    await env.DB.prepare(
      'INSERT INTO claims (item_id, guest_token_hash, state) VALUES (?1, ?2, ?3)'
    )
      .bind(f.item.id, 'a'.repeat(64), 'purchased')
      .run();
    expect(await reservation(f.token)).toBe('reserved');
    await expect(changeGuestClaim(env.DB, f.token, f.item.id, 'release')).rejects.toThrow();
    const giverItem = (await listFamilyWishlists(env.DB, f.giver.id)).find(
      (list) => list.id === f.owner.wishlistId
    )!.items[0];
    expect(giverItem).toMatchObject({ claim: { claimedByDisplayName: 'A guest' } });
    await releaseGuestClaim(env.DB, f.giver.id, f.item.id);
    await changeGuestClaim(env.DB, f.token, f.item.id, 'claim');
    expect(await reservation(f.token)).toBe('yours');
  });

  it('allows only enabled non-owner family members to clear guest claims, never member claims', async () => {
    const f = await fixture();
    await claimWishlistItem(env.DB, f.giver.id, f.item.id);
    await expect(releaseGuestClaim(env.DB, f.owner.id, f.item.id)).rejects.toThrow();
    await expect(releaseGuestClaim(env.DB, f.giver.id, f.item.id)).rejects.toThrow();
    await env.DB.prepare('DELETE FROM claims WHERE item_id = ?1').bind(f.item.id).run();
    await changeGuestClaim(env.DB, f.token, f.item.id, 'claim');
    await expect(releaseGuestClaim(env.DB, f.owner.id, f.item.id)).rejects.toThrow();
    await env.DB.prepare('UPDATE members SET disabled_at = ?1 WHERE id = ?2')
      .bind('2026-10-27', f.giver.id)
      .run();
    await expect(releaseGuestClaim(env.DB, f.giver.id, f.item.id)).rejects.toThrow();
    await expect(releaseGuestClaim(env.DB, crypto.randomUUID(), f.item.id)).rejects.toThrow();
    await env.DB.prepare('UPDATE members SET disabled_at = NULL WHERE id = ?1')
      .bind(f.giver.id)
      .run();
    await releaseGuestClaim(env.DB, f.giver.id, f.item.id);
    expect(await reservation(f.token)).toBe('available');
  });

  it('enforces one atomic hourly budget per link across devices', async () => {
    const f = await fixture();
    for (let i = 0; i < 200; i++) await consumeGuestClaimBudget(env.DB, f.token, 3600000);
    await expect(consumeGuestClaimBudget(env.DB, f.token, 3600000)).rejects.toThrow('Too many');
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM guest_claim_limits').first()).toEqual({
      n: 1
    });
    await consumeGuestClaimBudget(env.DB, f.token, 7200000);
    await env.DB.prepare('UPDATE guest_claim_limits SET attempts = 199').run();
    const results = await Promise.allSettled(
      [0, 1].map(() => consumeGuestClaimBudget(env.DB, f.token, 7200000))
    );
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await env.DB.prepare('SELECT attempts FROM guest_claim_limits').first()).toEqual({
      attempts: 200
    });
    const args = routeArgs(f.token);
    await env.DB.prepare('UPDATE guest_claim_limits SET hour = ?1')
      .bind(Math.floor(Date.now() / 3600000))
      .run();
    expect(await action({ ...args, request: request(f.token, 'claim', f.item.id) })).toMatchObject({
      init: { status: 429, headers: { 'Retry-After': '3600' } }
    });
    expect(await reservation(f.token)).toBe('available');
  });

  it('rejects cross-origin forms, invalid inputs and obsolete recovery actions', async () => {
    const f = await fixture();
    const args = routeArgs(f.token);
    const crossOrigin = request(f.token, 'claim', f.item.id);
    crossOrigin.headers.set('Origin', 'https://attacker.example');
    await expect(action({ ...args, request: crossOrigin })).rejects.toMatchObject({ status: 403 });
    for (const [intent, itemId] of [
      ['claim', 'invalid'],
      ['edit', f.item.id],
      ['recover', ''],
      ['confirm-claim', f.item.id]
    ]) {
      expect(await action({ ...args, request: request(f.token, intent, itemId) })).toMatchObject({
        init: { status: 409 }
      });
    }
    expect(await action(args)).toMatchObject({ init: { status: 405 } });
    expect(await reservation(f.token)).toBe('available');
    const link = (await listActiveWishlistShareLinks(env.DB, f.owner.id))[0];
    await revokeShareLink(env.DB, f.owner.id, link.id);
    await expect(loader(args)).rejects.toMatchObject({ init: { status: 404 } });
    await expect(
      action({ ...args, request: request(f.token, 'claim', f.item.id) })
    ).rejects.toMatchObject({ init: { status: 404 } });
  });
});
