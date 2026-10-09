import { SHARED_WISHLIST_IDS, SharedWishlistInputError, tokenHash } from './shared-wishlists';

export class GuestClaimLimitError extends Error {
  constructor() {
    super('Too many reservation attempts. Please try again in an hour.');
  }
}

// Recheck link membership and enabled owners inside every write, not only in the route loader.
const SHARED_ITEMS = `SELECT items.id FROM items
  INNER JOIN wishlists ON wishlists.id = items.wishlist_id
  INNER JOIN members AS owners ON owners.id = wishlists.owner_member_id
  WHERE owners.disabled_at IS NULL AND wishlists.id IN (${SHARED_WISHLIST_IDS})`;

export async function consumeGuestClaimBudget(
  db: D1Database,
  token: string,
  guestHash: string,
  now = Date.now()
) {
  const linkHash = await tokenHash(token);
  const hour = Math.floor(now / 3600000);
  await db
    .prepare('DELETE FROM guest_claim_limits WHERE hour < ?1')
    .bind(hour - 24)
    .run();
  const results = await db.batch(
    [
      ['link:' + linkHash, 200],
      ['guest:' + guestHash, 40]
    ].map(([scope, limit]) =>
      db
        .prepare(
          `INSERT INTO guest_claim_limits (scope, hour, attempts)
    VALUES (?1, ?2, 1) ON CONFLICT(scope) DO UPDATE SET hour = excluded.hour,
    attempts = CASE WHEN guest_claim_limits.hour = excluded.hour THEN guest_claim_limits.attempts + 1 ELSE 1 END
    WHERE guest_claim_limits.hour <> excluded.hour OR guest_claim_limits.attempts < ?3`
        )
        .bind(scope, hour, limit)
    )
  );
  if (results.some((result) => result.meta.changes !== 1)) throw new GuestClaimLimitError();
}

export async function hasGuestClaims(
  db: D1Database,
  token: string,
  guestHash: string
): Promise<boolean> {
  return !!(await db
    .prepare(
      `SELECT 1 FROM claims WHERE guest_token_hash = ?2
    AND item_id IN (${SHARED_ITEMS}) LIMIT 1`
    )
    .bind(await tokenHash(token), guestHash)
    .first());
}

export async function changeGuestClaim(
  db: D1Database,
  token: string,
  guestHash: string,
  itemId: unknown,
  intent: unknown
): Promise<void> {
  if (
    typeof itemId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(itemId) ||
    !/^[0-9a-f]{64}$/.test(guestHash)
  )
    throw new SharedWishlistInputError('That reservation request is invalid.');
  const scope = `item_id = ?3 AND guest_token_hash = ?2 AND item_id IN (${SHARED_ITEMS})`;
  let sql: string;
  if (intent === 'claim')
    sql = `INSERT INTO claims (item_id, guest_token_hash)
    SELECT id, ?2 FROM (${SHARED_ITEMS}) WHERE id = ?3 ON CONFLICT(item_id) DO NOTHING`;
  else if (intent === 'release') sql = `DELETE FROM claims WHERE ${scope}`;
  else if (intent === 'bought' || intent === 'unbought')
    sql = `UPDATE claims SET state = '${intent === 'bought' ? 'purchased' : 'claimed'}',
    updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE ${scope}`;
  else throw new SharedWishlistInputError('Choose a reservation action from the list.');
  const result = await db
    .prepare(sql)
    .bind(await tokenHash(token), guestHash, itemId)
    .run();
  if (result.meta.changes !== 1)
    throw new SharedWishlistInputError(
      'This gift is no longer available, or this reservation belongs to someone else. Refresh the list to check.'
    );
}
