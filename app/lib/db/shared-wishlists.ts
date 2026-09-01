import type { ItemPriority } from './wishlists';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/;

type SharedWishlistRow = {
  wishlist_id: string;
  owner_display_name: string;
  item_id: string | null;
  item_title: string | null;
  item_notes: string | null;
  item_product_url: string | null;
  item_image_url: string | null;
  item_price_amount_minor: number | null;
  item_price_currency: string | null;
  item_priority: ItemPriority | null;
};

export type SharedWishlistItem = {
  id: string;
  title: string;
  notes: string | null;
  productUrl: string | null;
  hasImage: boolean;
  priceAmountMinor: number | null;
  priceCurrency: string | null;
  priority: ItemPriority;
};

export type SharedWishlist = {
  id: string;
  ownerDisplayName: string;
  items: SharedWishlistItem[];
};

export class SharedWishlistInputError extends Error {}
export class SharedImageRateLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super('That shared list has loaded lots of pictures. Try again in a little while.');
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function requireUuid(value: unknown, label: string): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new SharedWishlistInputError(`${label} is invalid.`);
  }
  return value;
}

function requireToken(value: unknown): string {
  if (typeof value !== 'string' || !SHARE_TOKEN_PATTERN.test(value)) {
    throw new SharedWishlistInputError('The sharing link is invalid.');
  }
  return value;
}

function makeShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

async function hashShareToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function tokenHash(value: unknown): Promise<string> {
  return hashShareToken(requireToken(value));
}

export async function hasWishlistShareLink(db: D1Database, wishlistId: string): Promise<boolean> {
  const targetWishlistId = requireUuid(wishlistId, 'The wishlist');
  const row = await db
    .prepare('SELECT 1 AS active FROM wishlist_share_links WHERE wishlist_id = ?1')
    .bind(targetWishlistId)
    .first<{ active: number }>();
  return row?.active === 1;
}

export async function replaceWishlistShareLink(
  db: D1Database,
  actorMemberId: string,
  wishlistId: string
): Promise<string> {
  const actorId = requireUuid(actorMemberId, 'The signed-in member');
  const targetWishlistId = requireUuid(wishlistId, 'The wishlist');
  const token = makeShareToken();
  const hash = await hashShareToken(token);

  const result = await db
    .prepare(
      `INSERT INTO wishlist_share_links (
         wishlist_id, token_hash, created_by_member_id
       )
       SELECT wishlists.id, ?1, members.id
       FROM wishlists
       INNER JOIN members ON members.id = ?2
       WHERE wishlists.id = ?3
       ON CONFLICT (wishlist_id) DO UPDATE SET
         token_hash = excluded.token_hash,
         created_by_member_id = excluded.created_by_member_id,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`
    )
    .bind(hash, actorId, targetWishlistId)
    .run();

  if (!result.success || result.meta.changes !== 1) {
    throw new SharedWishlistInputError(
      'We couldn’t find that wishlist. Refresh the page and try again.'
    );
  }

  return token;
}

export async function revokeWishlistShareLink(
  db: D1Database,
  actorMemberId: string,
  wishlistId: string
): Promise<void> {
  const actorId = requireUuid(actorMemberId, 'The signed-in member');
  const targetWishlistId = requireUuid(wishlistId, 'The wishlist');
  const result = await db
    .prepare(
      `DELETE FROM wishlist_share_links
       WHERE wishlist_id = ?1
         AND EXISTS (SELECT 1 FROM members WHERE id = ?2)`
    )
    .bind(targetWishlistId, actorId)
    .run();

  if (!result.success) {
    throw new SharedWishlistInputError('We couldn’t stop sharing that wishlist. Try again.');
  }
}

export async function getSharedWishlist(
  db: D1Database,
  token: unknown
): Promise<SharedWishlist | null> {
  const hash = await tokenHash(token);
  const { results } = await db
    .prepare(
      `SELECT
         wishlists.id AS wishlist_id,
         members.display_name AS owner_display_name,
         items.id AS item_id,
         items.title AS item_title,
         items.notes AS item_notes,
         items.product_url AS item_product_url,
         items.image_url AS item_image_url,
         items.price_amount_minor AS item_price_amount_minor,
         items.price_currency AS item_price_currency,
         items.priority AS item_priority
       FROM wishlist_share_links
       INNER JOIN wishlists ON wishlists.id = wishlist_share_links.wishlist_id
       INNER JOIN members ON members.id = wishlists.owner_member_id
       LEFT JOIN items ON items.wishlist_id = wishlists.id
       WHERE wishlist_share_links.token_hash = ?1
       ORDER BY
         CASE items.priority
           WHEN 'high' THEN 0
           WHEN 'normal' THEN 1
           ELSE 2
         END,
         items.created_at DESC,
         items.id DESC`
    )
    .bind(hash)
    .all<SharedWishlistRow>();

  const first = results[0];
  if (!first) return null;

  return {
    id: first.wishlist_id,
    ownerDisplayName: first.owner_display_name,
    items: results.flatMap((row) =>
      row.item_id && row.item_title && row.item_priority
        ? [
            {
              id: row.item_id,
              title: row.item_title,
              notes: row.item_notes,
              productUrl: row.item_product_url,
              hasImage: Boolean(row.item_image_url),
              priceAmountMinor: row.item_price_amount_minor,
              priceCurrency: row.item_price_currency,
              priority: row.item_priority
            }
          ]
        : []
    )
  };
}

export async function getSharedWishlistImageUrl(
  db: D1Database,
  token: unknown,
  itemId: unknown
): Promise<{ imageUrl: string; wishlistId: string } | null> {
  const hash = await tokenHash(token);
  const targetItemId = requireUuid(itemId, 'The wish');
  return db
    .prepare(
      `SELECT items.image_url AS imageUrl, wishlists.id AS wishlistId
       FROM wishlist_share_links
       INNER JOIN wishlists ON wishlists.id = wishlist_share_links.wishlist_id
       INNER JOIN items ON items.wishlist_id = wishlists.id
       WHERE wishlist_share_links.token_hash = ?1
         AND items.id = ?2
         AND items.image_url IS NOT NULL`
    )
    .bind(hash, targetItemId)
    .first<{ imageUrl: string; wishlistId: string }>();
}

export async function consumeSharedImageBudget(
  db: D1Database,
  wishlistId: string,
  now = Date.now()
): Promise<void> {
  const targetWishlistId = requireUuid(wishlistId, 'The wishlist');
  const nowSeconds = Math.floor(now / 1000);
  const minuteStartedAt = nowSeconds - (nowSeconds % 60);
  const dayStartedAt = nowSeconds - (nowSeconds % 86_400);
  const result = await db
    .prepare(
      `INSERT INTO shared_image_fetch_limits (
         wishlist_id, minute_started_at, minute_request_count,
         day_started_at, day_request_count
       ) VALUES (?1, ?2, 1, ?3, 1)
       ON CONFLICT (wishlist_id) DO UPDATE SET
         minute_started_at = CASE
           WHEN shared_image_fetch_limits.minute_started_at = excluded.minute_started_at
             THEN shared_image_fetch_limits.minute_started_at
           ELSE excluded.minute_started_at
         END,
         minute_request_count = CASE
           WHEN shared_image_fetch_limits.minute_started_at = excluded.minute_started_at
             THEN shared_image_fetch_limits.minute_request_count + 1
           ELSE 1
         END,
         day_started_at = CASE
           WHEN shared_image_fetch_limits.day_started_at = excluded.day_started_at
             THEN shared_image_fetch_limits.day_started_at
           ELSE excluded.day_started_at
         END,
         day_request_count = CASE
           WHEN shared_image_fetch_limits.day_started_at = excluded.day_started_at
             THEN shared_image_fetch_limits.day_request_count + 1
           ELSE 1
         END
       WHERE
         (shared_image_fetch_limits.minute_started_at <> excluded.minute_started_at
           OR shared_image_fetch_limits.minute_request_count < 60)
         AND
         (shared_image_fetch_limits.day_started_at <> excluded.day_started_at
           OR shared_image_fetch_limits.day_request_count < 500)`
    )
    .bind(targetWishlistId, minuteStartedAt, dayStartedAt)
    .run();

  if (!result.success) throw new SharedWishlistInputError('That picture could not be loaded.');
  if (result.meta.changes !== 1) {
    const limit = await db
      .prepare(
        `SELECT minute_started_at, minute_request_count, day_started_at, day_request_count
         FROM shared_image_fetch_limits
         WHERE wishlist_id = ?1`
      )
      .bind(targetWishlistId)
      .first<{
        minute_started_at: number;
        minute_request_count: number;
        day_started_at: number;
        day_request_count: number;
      }>();
    const dayLimited =
      limit?.day_started_at === dayStartedAt && (limit?.day_request_count ?? 0) >= 500;
    const retryAt = dayLimited ? dayStartedAt + 86_400 : minuteStartedAt + 60;
    const retryAfterSeconds = Math.max(1, retryAt - nowSeconds);
    throw new SharedImageRateLimitError(retryAfterSeconds);
  }
}
