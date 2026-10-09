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
  revokeWishlistShareLink,
  listActiveWishlistShareLinks
} from '../app/lib/db/shared-wishlists';
import {
  claimWishlistItem,
  createWishlistItem,
  listFamilyWishlists,
  releaseGuestClaim
} from '../app/lib/db/wishlists';
import {
  changeGuestClaim,
  consumeGuestClaimBudget,
  hasGuestClaims
} from '../app/lib/db/guest-claims';
import {
  createGuestSecret,
  guestCookie,
  hashGuestSecret,
  readGuestSecret
} from '../app/lib/guest-identity';
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
  const token = await createWishlistShareLink(env.DB, owner.id, owner.wishlistId, 'Friends');
  const secret = createGuestSecret();
  return { owner, giver, item, token, secret, hash: await hashGuestSecret(secret) };
}
function context() {
  const context = new RouterContextProvider();
  context.set(cloudflareContext, { env, ctx: createExecutionContext(), cspNonce: 'test-nonce' });
  return context;
}
function request(
  token: string,
  secret: string,
  intent: string,
  itemId = '',
  extra: Record<string, string> = {}
) {
  return new Request(`${origin}/shared/${token}`, {
    method: 'POST',
    headers: { Origin: origin, Cookie: guestCookie(new Request(origin), secret).split(';')[0] },
    body: new URLSearchParams({ intent, itemId, ...extra })
  });
}

describe('guest reservations', () => {
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
  it('shares one reservation with members, exposes only availability, and hides owner data', async () => {
    const f = await fixture();
    await changeGuestClaim(env.DB, f.token, f.hash, f.item.id, 'claim');
    const publicLists = await getSharedWishlists(env.DB, f.token);
    expect(publicLists[0].items[0].reservation).toBe('reserved');
    expect(JSON.stringify(publicLists)).not.toContain(f.hash);
    expect(JSON.stringify(publicLists)).not.toContain(f.secret);
    expect((await getSharedWishlists(env.DB, f.token, f.hash))[0].items[0].reservation).toBe(
      'yours'
    );
    const ownerItem = (await listFamilyWishlists(env.DB, f.owner.id)).find(
      (list) => list.id === f.owner.wishlistId
    )!.items[0];
    expect(ownerItem.claimVisibility).toBe('hidden');
    expect(ownerItem).not.toHaveProperty('claim');
    const giverItem = (await listFamilyWishlists(env.DB, f.giver.id)).find(
      (list) => list.id === f.owner.wishlistId
    )!.items[0];
    expect(giverItem).toMatchObject({
      claim: { claimedByDisplayName: 'A guest', isClaimedByViewer: false }
    });
    await expect(claimWishlistItem(env.DB, f.giver.id, f.item.id)).rejects.toThrow();
    await changeGuestClaim(env.DB, f.token, f.hash, f.item.id, 'bought');
    expect((await getSharedWishlists(env.DB, f.token))[0].items[0].reservation).toBe('reserved');
    expect((await getSharedWishlists(env.DB, f.token, f.hash))[0].items[0].reservation).toBe(
      'bought'
    );
    await changeGuestClaim(env.DB, f.token, f.hash, f.item.id, 'unbought');
    await changeGuestClaim(env.DB, f.token, f.hash, f.item.id, 'release');
    expect((await getSharedWishlists(env.DB, f.token))[0].items[0].reservation).toBe('available');
  });
  it('permits exactly one winner across concurrent member and guest requests', async () => {
    const f = await fixture();
    const results = await Promise.allSettled([
      changeGuestClaim(env.DB, f.token, f.hash, f.item.id, 'claim'),
      claimWishlistItem(env.DB, f.giver.id, f.item.id)
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(
      (await env.DB.prepare('SELECT COUNT(*) AS n FROM claims').first<{ n: number }>())?.n
    ).toBe(1);
  });
  it('scopes guest writes and recovery to the selected lists on a family link', async () => {
    const f = await fixture();
    const third = await inviteAndProvisionMember(env.DB, f.owner, 'third@example.com');
    const selected = await createFamilyShareLink(
      env.DB,
      f.owner.id,
      [f.owner.wishlistId, f.giver.wishlistId],
      'Both lists'
    );
    const excluded = await createFamilyShareLink(
      env.DB,
      f.owner.id,
      [third.wishlistId],
      'Other list'
    );
    const otherHash = await hashGuestSecret(createGuestSecret());
    const results = await Promise.allSettled([
      changeGuestClaim(env.DB, selected.token, f.hash, f.item.id, 'claim'),
      changeGuestClaim(env.DB, selected.token, otherHash, f.item.id, 'claim')
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const winningHash = results[0].status === 'fulfilled' ? f.hash : otherHash;
    expect(await hasGuestClaims(env.DB, selected.token, winningHash)).toBe(true);
    expect(await hasGuestClaims(env.DB, excluded.token, winningHash)).toBe(false);
    await expect(
      changeGuestClaim(env.DB, excluded.token, winningHash, f.item.id, 'bought')
    ).rejects.toThrow();
    await revokeShareLink(env.DB, f.owner.id, selected.shareLinkId);
    await expect(
      changeGuestClaim(env.DB, selected.token, winningHash, f.item.id, 'bought')
    ).rejects.toThrow();
    expect(await hasGuestClaims(env.DB, selected.token, winningHash)).toBe(false);
    // Another active link to the same list can still recover and manage the reservation.
    expect(await hasGuestClaims(env.DB, f.token, winningHash)).toBe(true);
    await changeGuestClaim(env.DB, f.token, winningHash, f.item.id, 'bought');
  });
  it('allows only enabled non-owner family members to clear guest claims, never member claims', async () => {
    const f = await fixture();
    await claimWishlistItem(env.DB, f.giver.id, f.item.id);
    await expect(releaseGuestClaim(env.DB, f.owner.id, f.item.id)).rejects.toThrow();
    await expect(releaseGuestClaim(env.DB, f.giver.id, f.item.id)).rejects.toThrow();
    await env.DB.prepare('DELETE FROM claims WHERE item_id = ?1').bind(f.item.id).run();
    await changeGuestClaim(env.DB, f.token, f.hash, f.item.id, 'claim');
    await env.DB.prepare('UPDATE members SET disabled_at = ?1 WHERE id = ?2')
      .bind('2026-10-09', f.giver.id)
      .run();
    await expect(releaseGuestClaim(env.DB, f.giver.id, f.item.id)).rejects.toThrow();
    await expect(releaseGuestClaim(env.DB, crypto.randomUUID(), f.item.id)).rejects.toThrow();
    await env.DB.prepare('UPDATE members SET disabled_at = NULL WHERE id = ?1')
      .bind(f.giver.id)
      .run();
    await releaseGuestClaim(env.DB, f.giver.id, f.item.id);
    expect((await getSharedWishlists(env.DB, f.token))[0].items[0].reservation).toBe('available');
  });
  it('rejects another guest, unrelated items, invalid intent and revoked or disabled access', async () => {
    const f = await fixture();
    await changeGuestClaim(env.DB, f.token, f.hash, f.item.id, 'claim');
    const other = await hashGuestSecret(createGuestSecret());
    for (const intent of ['release', 'bought', 'unbought', 'claim'])
      await expect(changeGuestClaim(env.DB, f.token, other, f.item.id, intent)).rejects.toThrow();
    await expect(changeGuestClaim(env.DB, f.token, f.hash, f.item.id, 'edit')).rejects.toThrow();
    const unrelated = await createWishlistShareLink(
      env.DB,
      f.giver.id,
      f.giver.wishlistId,
      'Other'
    );
    await expect(
      changeGuestClaim(env.DB, unrelated, f.hash, f.item.id, 'release')
    ).rejects.toThrow();
    await env.DB.prepare('UPDATE members SET disabled_at = ?1 WHERE id = ?2')
      .bind('2026-10-09', f.owner.id)
      .run();
    await expect(changeGuestClaim(env.DB, f.token, f.hash, f.item.id, 'release')).rejects.toThrow();
    await env.DB.prepare('UPDATE members SET disabled_at = NULL WHERE id = ?1')
      .bind(f.owner.id)
      .run();
    const link = (await listActiveWishlistShareLinks(env.DB, f.owner.id)).find(
      (link) => link.wishlistId === f.owner.wishlistId
    )!;
    await revokeWishlistShareLink(env.DB, f.owner.id, link.id);
    await expect(changeGuestClaim(env.DB, f.token, f.hash, f.item.id, 'release')).rejects.toThrow();
    expect(await env.DB.prepare('SELECT COUNT(*) AS n FROM claims').first()).toEqual({ n: 1 });
    await expect(releaseGuestClaim(env.DB, f.owner.id, f.item.id)).rejects.toThrow();
    await releaseGuestClaim(env.DB, f.giver.id, f.item.id);
  });
  it('enforces per-guest and per-link budgets even when guests rotate credentials', async () => {
    const f = await fixture();
    for (let i = 0; i < 40; i++) await consumeGuestClaimBudget(env.DB, f.token, f.hash, 3600000);
    await expect(consumeGuestClaimBudget(env.DB, f.token, f.hash, 3600000)).rejects.toThrow(
      'Too many'
    );
    await consumeGuestClaimBudget(env.DB, f.token, f.hash, 7200000);
    await env.DB.prepare(
      "UPDATE guest_claim_limits SET attempts = 200 WHERE scope LIKE 'link:%'"
    ).run();
    await expect(
      consumeGuestClaimBudget(env.DB, f.token, await hashGuestSecret(createGuestSecret()), 7200000)
    ).rejects.toThrow('Too many');
  });
  it('sets a private cookie and handles plain form actions, recovery and missing cookies', async () => {
    const f = await fixture();
    const args = {
      params: { token: f.token },
      context: context(),
      request: new Request(`${origin}/shared/${f.token}`),
      pattern: '/shared/:token',
      url: new URL(`${origin}/shared/${f.token}`)
    };
    const loaded = await loader(args);
    expect(loaded.data.recoveryCode).toHaveLength(43);
    const cookie = new Headers(loaded.init?.headers).get('Set-Cookie')!;
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    const claimed = await action({
      ...args,
      request: request(f.token, f.secret, 'claim', f.item.id)
    });
    expect(claimed).toBeInstanceOf(Response);
    if (claimed instanceof Response) expect(claimed.status).toBe(303);
    expect(await hasGuestClaims(env.DB, f.token, f.hash)).toBe(true);
    const recovered = await action({
      ...args,
      request: request(f.token, createGuestSecret(), 'recover', '', { recoveryCode: f.secret })
    });
    expect(recovered).toBeInstanceOf(Response);
    if (recovered instanceof Response)
      expect(recovered.headers.get('Set-Cookie')).toContain(f.secret);
    const missing = request(f.token, f.secret, 'release', f.item.id);
    missing.headers.delete('Cookie');
    expect(await action({ ...args, request: missing })).toMatchObject({ init: { status: 409 } });
    const crossOrigin = request(f.token, f.secret, 'release', f.item.id);
    crossOrigin.headers.set('Origin', 'https://attacker.example');
    await expect(action({ ...args, request: crossOrigin })).rejects.toMatchObject({ status: 403 });
    expect(
      await action({
        ...args,
        request: request(f.token, f.secret, 'recover', '', { recoveryCode: createGuestSecret() })
      })
    ).toMatchObject({ init: { status: 409 } });
  });
  it('does not accept injected, malformed or duplicate guest cookies', () => {
    const secret = createGuestSecret();
    expect(
      readGuestSecret(
        new Request(origin, { headers: { Cookie: `__Host-wishlist-guest=${secret}` } })
      )
    ).toBe(secret);
    expect(
      readGuestSecret(
        new Request(origin, {
          headers: { Cookie: `__Host-wishlist-guest=${secret}; __Host-wishlist-guest=${secret}` }
        })
      )
    ).toBeNull();
    expect(
      readGuestSecret(new Request(origin, { headers: { Cookie: '__Host-wishlist-guest=bad' } }))
    ).toBeNull();
  });
});
