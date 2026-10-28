import { applyD1Migrations } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { expect, it } from 'vitest';

import { changeGuestClaim } from '../app/lib/db/guest-claims';
import { createFamilyShareLink, getSharedWishlists } from '../app/lib/db/shared-wishlists';
import { listFamilyWishlists } from '../app/lib/db/wishlists';

it('upgrades v1.1.3 reservations without losing data and safely retries applied migrations', async () => {
  const db = env.UPGRADE_DB;
  await applyD1Migrations(
    db,
    env.TEST_MIGRATIONS.filter(
      (migration) => migration.name <= '0015_shared_image_list_sized_limits.sql'
    )
  );
  const owner = crypto.randomUUID();
  const giver = crypto.randomUUID();
  const wishlist = crypto.randomUUID();
  const [familyItem, guestItem, boughtItem, newItem, rollingItem] = Array.from({ length: 5 }, () =>
    crypto.randomUUID()
  );
  await db.batch([
    db
      .prepare('INSERT INTO members (id, email, display_name) VALUES (?1, ?2, ?3)')
      .bind(owner, 'recipient@example.com', 'Recipient'),
    db
      .prepare('INSERT INTO members (id, email, display_name) VALUES (?1, ?2, ?3)')
      .bind(giver, 'giver@example.com', 'Giver'),
    db.prepare('INSERT INTO wishlists (id, owner_member_id) VALUES (?1, ?2)').bind(wishlist, owner),
    ...[familyItem, guestItem, boughtItem, newItem, rollingItem].map((id) =>
      db
        .prepare(
          'INSERT INTO items (id, wishlist_id, title, created_by_member_id) VALUES (?1, ?2, ?3, ?4)'
        )
        .bind(id, wishlist, 'Existing gift', owner)
    ),
    db
      .prepare(
        "INSERT INTO claims (item_id, claimed_by_member_id, state) VALUES (?1, ?2, 'purchased')"
      )
      .bind(familyItem, giver),
    db
      .prepare('INSERT INTO claims (item_id, guest_token_hash) VALUES (?1, ?2)')
      .bind(guestItem, 'a'.repeat(64)),
    db
      .prepare("INSERT INTO claims (item_id, guest_token_hash, state) VALUES (?1, ?2, 'purchased')")
      .bind(boughtItem, 'b'.repeat(64))
  ]);
  const link = await createFamilyShareLink(db, owner, [wishlist], 'Uncle David');
  const claimsBefore = (await db.prepare('SELECT * FROM claims ORDER BY item_id').all()).results;
  const itemsBefore = (await db.prepare('SELECT * FROM items ORDER BY id').all()).results;
  const linksBefore = (await db.prepare('SELECT * FROM family_share_links').all()).results;

  await applyD1Migrations(db, env.TEST_MIGRATIONS);
  await applyD1Migrations(db, env.TEST_MIGRATIONS);
  expect((await db.prepare('SELECT * FROM claims ORDER BY item_id').all()).results).toEqual(
    claimsBefore.map((claim) => ({ ...claim, share_link_name: null }))
  );
  expect((await db.prepare('SELECT * FROM items ORDER BY id').all()).results).toEqual(itemsBefore);
  expect((await db.prepare('SELECT * FROM family_share_links').all()).results).toEqual(linksBefore);

  // During a rolling update, the previous Worker can still write its old column list.
  await db
    .prepare('INSERT INTO claims (item_id, guest_token_hash) VALUES (?1, ?2)')
    .bind(rollingItem, 'c'.repeat(64))
    .run();
  await changeGuestClaim(db, link.token, newItem, 'claim');
  await changeGuestClaim(db, link.token, newItem, 'bought');
  const shared = (await getSharedWishlists(db, link.token))[0];
  expect(shared.items.find((item) => item.id === newItem)?.reservation).toBe('bought');
  for (const id of [familyItem, guestItem, boughtItem, rollingItem]) {
    expect(shared.items.find((item) => item.id === id)?.reservation).toBe('reserved');
    await expect(changeGuestClaim(db, link.token, id, 'release')).rejects.toThrow();
  }
  const ownItems = (await listFamilyWishlists(db, owner))[0].items;
  for (const item of ownItems) {
    expect(item.claimVisibility).toBe('hidden');
    expect(item).not.toHaveProperty('claim');
  }
  expect((await db.prepare('PRAGMA foreign_key_check').all()).results).toEqual([]);
});
