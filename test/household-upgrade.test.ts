import { applyD1Migrations } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import {
  activateFamilyInvitation,
  beginFamilyInvitation,
  completeFamilyMemberRemoval,
  listFamilyPeople,
  prepareFamilyMemberRemoval
} from '../app/lib/db/family-members';
import { ensureMemberForEmail } from '../app/lib/db/members';
import { getSharedWishlist, getSharedWishlistImageUrl } from '../app/lib/db/shared-wishlists';
import { listFamilyWishlists } from '../app/lib/db/wishlists';

async function snapshot(db: D1Database) {
  const results = await db.batch<Record<string, unknown>>([
    db.prepare('SELECT * FROM members ORDER BY id'),
    db.prepare('SELECT * FROM wishlists ORDER BY id'),
    db.prepare('SELECT * FROM items ORDER BY id'),
    db.prepare(
      'SELECT item_id, claimed_by_member_id, state, created_at, updated_at FROM claims ORDER BY item_id'
    ),
    db.prepare('SELECT * FROM family_invitations ORDER BY id'),
    db.prepare('SELECT * FROM wishlist_share_links ORDER BY id')
  ]);
  return results.map((result) => result.results);
}

async function seedOlderHousehold(db: D1Database) {
  const admin = { id: crypto.randomUUID(), email: 'admin@example.com' };
  const owners = [
    { email: 'active@example.com', disabledAt: null, status: 'active' },
    { email: 'removed@example.com', disabledAt: '2026-08-02T00:00:00Z', status: 'revoked' },
    {
      email: 'removing@example.com',
      disabledAt: '2026-08-03T00:00:00Z',
      status: 'revocation_required'
    }
  ].map((owner, index) => ({
    ...owner,
    id: crypto.randomUUID(),
    wishlistId: crypto.randomUUID(),
    itemId: crypto.randomUUID(),
    invitationId: crypto.randomUUID(),
    token: `${'A'.repeat(21)}${index}`
  }));
  await db
    .prepare(
      "INSERT INTO members (id, email, display_name, role) VALUES (?1, ?2, 'Organiser', 'admin')"
    )
    .bind(admin.id, admin.email)
    .run();
  await db
    .prepare('INSERT INTO wishlists (id, owner_member_id) VALUES (?1, ?2)')
    .bind(crypto.randomUUID(), admin.id)
    .run();
  for (const owner of owners) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(owner.token));
    const hash = [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    await db.batch([
      db
        .prepare(
          "INSERT INTO members (id, email, display_name, role, disabled_at) VALUES (?1, ?2, ?2, 'member', ?3)"
        )
        .bind(owner.id, owner.email, owner.disabledAt),
      db
        .prepare('INSERT INTO wishlists (id, owner_member_id) VALUES (?1, ?2)')
        .bind(owner.wishlistId, owner.id),
      db
        .prepare(
          `INSERT INTO items (id, wishlist_id, title, image_url, created_by_member_id)
           VALUES (?1, ?2, 'Existing wish', 'https://cdn.example.com/gift.webp', ?3)`
        )
        .bind(owner.itemId, owner.wishlistId, admin.id),
      db
        .prepare(
          "INSERT INTO claims (item_id, claimed_by_member_id, state) VALUES (?1, ?2, 'purchased')"
        )
        .bind(owner.itemId, admin.id),
      db
        .prepare(
          `INSERT INTO family_invitations
             (id, email, display_name, access_policy_id, status, invited_by_member_id)
           VALUES (?1, ?2, ?2, ?3, ?4, ?5)`
        )
        .bind(
          owner.invitationId,
          owner.email,
          owner.status === 'revoked' ? null : crypto.randomUUID(),
          owner.status,
          admin.id
        ),
      db
        .prepare(
          `INSERT INTO wishlist_share_links
             (id, wishlist_id, name, token_hash, created_by_member_id)
           VALUES (?1, ?2, 'Existing link', ?3, ?4)`
        )
        .bind(crypto.randomUUID(), owner.wishlistId, hash, admin.id)
    ]);
  }
  const waitingInvitationId = crypto.randomUUID();
  await db.batch([
    db
      .prepare(
        `INSERT INTO family_invitations
           (id, email, display_name, access_policy_id, status, invited_by_member_id)
         VALUES (?1, 'waiting@example.com', 'Waiting', ?2, 'active', ?3)`
      )
      .bind(waitingInvitationId, crypto.randomUUID(), admin.id),
    db
      .prepare(
        `INSERT INTO family_invitations
           (id, email, display_name, access_policy_id, status, invited_by_member_id)
         VALUES (?1, 'repair@example.com', 'Repair', ?2, 'cleanup_required', ?3)`
      )
      .bind(crypto.randomUUID(), crypto.randomUUID(), admin.id)
  ]);
  // Older installations allowed five links per list, so some already exceed the new family limit.
  const activeOwner = owners[0];
  if (!activeOwner) throw new Error('Expected an active legacy owner');
  const extraTokens = ['B'.repeat(22), 'C'.repeat(22), 'D'.repeat(22)];
  for (const token of extraTokens) {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    const hash = [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    await db
      .prepare(
        `INSERT INTO wishlist_share_links
           (id, wishlist_id, name, token_hash, created_by_member_id)
         VALUES (?1, ?2, 'Another existing link', ?3, ?4)`
      )
      .bind(crypto.randomUUID(), activeOwner.wishlistId, hash, admin.id)
      .run();
  }
  return { admin, owners, waitingInvitationId, extraTokens };
}

describe('existing household upgrades', () => {
  it('preserves older data, invitations and links through migrations and restores removed owners in place', async () => {
    const db = env.UPGRADE_DB;
    // This database deliberately starts before invitation-time wishlist provisioning.
    await applyD1Migrations(
      db,
      env.TEST_MIGRATIONS.filter((migration) => migration.name <= '0011_optimize_query_planner.sql')
    );
    const { admin, owners, waitingInvitationId, extraTokens } = await seedOlderHousehold(db);
    const before = await snapshot(db);
    expect(before[5]).toHaveLength(6);
    await applyD1Migrations(
      db,
      env.TEST_MIGRATIONS.filter((migration) => migration.name <= '0012_invited_wishlists.sql')
    );
    const afterProvisioning = await snapshot(db);
    for (const member of before[0] ?? []) {
      expect(
        await db.prepare('SELECT * FROM members WHERE id = ?1').bind(member.id).first()
      ).toEqual({
        ...member,
        first_signed_in_at: member.created_at
      });
    }
    expect(afterProvisioning[1]).toEqual(expect.arrayContaining(before[1] ?? []));
    expect(afterProvisioning[1]).toHaveLength((before[1]?.length ?? 0) + 1);
    expect(afterProvisioning.slice(2)).toEqual(before.slice(2));
    expect(
      await db
        .prepare('SELECT first_signed_in_at FROM members WHERE id = ?1')
        .bind(waitingInvitationId)
        .first()
    ).toEqual({ first_signed_in_at: null });

    // The next migration is additive: previous Worker queries and named tokens keep working.
    await applyD1Migrations(db, env.TEST_MIGRATIONS);
    expect(await snapshot(db)).toEqual(afterProvisioning);
    await applyD1Migrations(db, env.TEST_MIGRATIONS);
    expect(await snapshot(db)).toEqual(afterProvisioning);
    expect((await db.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
    expect(await db.prepare('PRAGMA quick_check').first()).toEqual({ quick_check: 'ok' });

    const [active, removed, removing] = owners;
    if (!active || !removed || !removing) throw new Error('Expected legacy owners');
    expect(await ensureMemberForEmail(db, active.email)).toMatchObject({
      id: active.id,
      wishlistId: active.wishlistId
    });
    expect(await getSharedWishlist(db, active.token)).toMatchObject({
      id: active.wishlistId,
      items: [{ id: active.itemId }]
    });
    for (const token of extraTokens) {
      expect(await getSharedWishlist(db, token)).toMatchObject({
        id: active.wishlistId,
        items: [{ id: active.itemId }]
      });
    }
    for (const owner of [removed, removing]) {
      expect(await getSharedWishlist(db, owner.token)).toBeNull();
      expect(await getSharedWishlistImageUrl(db, owner.token, owner.itemId)).toBeNull();
      expect((await listFamilyWishlists(db, admin.id)).map((list) => list.id)).not.toContain(
        owner.wishlistId
      );
    }
    expect(
      (await listFamilyPeople(db)).find((person) => person.id === waitingInvitationId)
    ).toMatchObject({ status: 'waiting', memberId: waitingInvitationId });
    expect(
      (await listFamilyPeople(db)).find((person) => person.email === 'repair@example.com')
    ).toMatchObject({ status: 'attention' });
    await expect(
      beginFamilyInvitation(db, admin.id, {
        email: removing.email,
        displayName: 'Still removing'
      })
    ).rejects.toThrow('already part');

    const invitation = await beginFamilyInvitation(db, admin.id, {
      email: removed.email,
      displayName: 'Welcome back'
    });
    expect(invitation.id).not.toBe(removed.invitationId);
    expect(await getSharedWishlist(db, removed.token)).toBeNull();
    await activateFamilyInvitation(db, invitation.id, crypto.randomUUID());
    expect(await ensureMemberForEmail(db, removed.email)).toMatchObject({
      id: removed.id,
      wishlistId: removed.wishlistId,
      displayName: 'Welcome back'
    });
    expect(await getSharedWishlist(db, removed.token)).toMatchObject({
      id: removed.wishlistId,
      items: [{ id: removed.itemId }]
    });
    const ownItem = (await listFamilyWishlists(db, removed.id)).find(
      (list) => list.id === removed.wishlistId
    )?.items[0];
    expect(ownItem).toMatchObject({ id: removed.itemId, claimVisibility: 'hidden' });
    expect(ownItem).not.toHaveProperty('claim');

    // An interrupted removal from the older Worker remains repairable after the upgrade.
    await prepareFamilyMemberRemoval(db, admin.id, removing.id);
    await completeFamilyMemberRemoval(db, removing.id);
    const retry = await beginFamilyInvitation(db, admin.id, {
      email: removing.email,
      displayName: 'Removal completed'
    });
    await activateFamilyInvitation(db, retry.id, crypto.randomUUID());
    expect(await ensureMemberForEmail(db, removing.email)).toMatchObject({
      id: removing.id,
      wishlistId: removing.wishlistId
    });
    const after = await snapshot(db);
    expect(after[1]).toEqual(afterProvisioning[1]);
    expect(after.slice(2, 4)).toEqual(before.slice(2, 4));
    expect(after[5]).toEqual(before[5]);
  });
});
