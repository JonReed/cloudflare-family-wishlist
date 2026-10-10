import { normaliseProductImageUrl } from '../product-url';
import type { ItemPriority } from './wishlists';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{22}$/;
const SHARE_LINK_NAME_MAX_LENGTH = 80;

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
  reserved: number;
  own_claim_state: string | null;
};

export type SharedWishlistItem = {
  id: string;
  title: string;
  notes: string | null;
  productUrl: string | null;
  imageUrl: string | null;
  priceAmountMinor: number | null;
  priceCurrency: string | null;
  priority: ItemPriority;
  reservation: 'available' | 'reserved' | 'yours' | 'bought';
};

export type SharedWishlist = {
  id: string;
  ownerDisplayName: string;
  items: SharedWishlistItem[];
};

export type ActiveWishlistShareLink = {
  id: string;
  name: string;
  wishlistId: string;
  ownerDisplayName: string;
  createdByDisplayName: string;
  createdAt: string;
};

export type ShareableWishlist = { id: string; ownerDisplayName: string };

export type ActiveFamilyShareLink = {
  id: string;
  name: string;
  createdByDisplayName: string;
  createdAt: string;
  wishlists: ShareableWishlist[];
};

export class SharedWishlistInputError extends Error {}
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

export function normaliseWishlistShareLinkName(value: unknown): string {
  if (typeof value !== 'string') {
    throw new SharedWishlistInputError(
      'Give this sharing link a name, such as the person you’re sending it to.'
    );
  }
  const name = value.trim().replace(/\s+/g, ' ');
  if (!name) {
    throw new SharedWishlistInputError(
      'Give this sharing link a name, such as the person you’re sending it to.'
    );
  }
  if (name.length > SHARE_LINK_NAME_MAX_LENGTH) {
    throw new SharedWishlistInputError(
      `Keep the sharing link name to ${SHARE_LINK_NAME_MAX_LENGTH} characters or fewer.`
    );
  }
  return name;
}

function makeShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function hashShareToken(token: string): Promise<string> {
  return sha256Hex(token);
}

export async function tokenHash(value: unknown): Promise<string> {
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

export async function countWishlistShareLinks(db: D1Database, wishlistId: string): Promise<number> {
  const targetWishlistId = requireUuid(wishlistId, 'The wishlist');
  const row = await db
    .prepare('SELECT COUNT(*) AS count FROM wishlist_share_links WHERE wishlist_id = ?1')
    .bind(targetWishlistId)
    .first<{ count: number }>();
  return row?.count ?? 0;
}

export async function listActiveWishlistShareLinks(
  db: D1Database,
  actorMemberId: string
): Promise<ActiveWishlistShareLink[]> {
  const actorId = requireUuid(actorMemberId, 'The signed-in member');
  const { results } = await db
    .prepare(
      `SELECT
         wishlist_share_links.id,
         wishlist_share_links.name,
         wishlist_share_links.wishlist_id AS wishlistId,
         owners.display_name AS ownerDisplayName,
         creators.display_name AS createdByDisplayName,
         wishlist_share_links.created_at AS createdAt
       FROM wishlist_share_links
       INNER JOIN wishlists ON wishlists.id = wishlist_share_links.wishlist_id
       INNER JOIN members AS owners ON owners.id = wishlists.owner_member_id
       INNER JOIN members AS creators ON creators.id = wishlist_share_links.created_by_member_id
       WHERE EXISTS (
         SELECT 1
         FROM members AS actors
         WHERE actors.id = ?1 AND actors.disabled_at IS NULL
       )
       ORDER BY
         owners.display_name COLLATE NOCASE,
         wishlist_share_links.created_at DESC,
         wishlist_share_links.id DESC`
    )
    .bind(actorId)
    .all<ActiveWishlistShareLink>();

  return results;
}

export async function createWishlistShareLink(
  db: D1Database,
  actorMemberId: string,
  wishlistId: string,
  name: unknown
): Promise<string> {
  const actorId = requireUuid(actorMemberId, 'The signed-in member');
  const targetWishlistId = requireUuid(wishlistId, 'The wishlist');
  const linkName = normaliseWishlistShareLinkName(name);
  const shareLinkId = crypto.randomUUID();
  const token = makeShareToken();
  const hash = await hashShareToken(token);

  const result = await db
    .prepare(
      `INSERT INTO wishlist_share_links (
         id, wishlist_id, name, token_hash, created_by_member_id
       )
       SELECT ?1, wishlists.id, ?2, ?3, members.id
       FROM wishlists
       INNER JOIN members ON members.id = ?4 AND members.disabled_at IS NULL
       INNER JOIN members AS owners ON owners.id = wishlists.owner_member_id
       WHERE wishlists.id = ?5 AND owners.disabled_at IS NULL
         AND ((SELECT COUNT(*) FROM wishlist_share_links) +
              (SELECT COUNT(*) FROM family_share_links)) < 5`
    )
    .bind(shareLinkId, linkName, hash, actorId, targetWishlistId)
    .run();

  if (!result.success || result.meta.changes !== 1) {
    const status = await db
      .prepare(
        `SELECT
           EXISTS (
             SELECT 1 FROM members WHERE id = ?1 AND disabled_at IS NULL
           ) AND EXISTS (
             SELECT 1 FROM wishlists
             INNER JOIN members AS owners ON owners.id = wishlists.owner_member_id
             WHERE wishlists.id = ?2 AND owners.disabled_at IS NULL
           ) AS targetFound,
           (
             (SELECT COUNT(*) FROM wishlist_share_links) +
             (SELECT COUNT(*) FROM family_share_links)
           ) AS activeLinkCount`
      )
      .bind(actorId, targetWishlistId)
      .first<{ targetFound: number; activeLinkCount: number }>();
    if (status?.targetFound === 1 && status.activeLinkCount >= 5) {
      throw new SharedWishlistInputError(
        'Your family already has five sharing links. Stop sharing one from Manage before making another.'
      );
    }
    throw new SharedWishlistInputError(
      'We couldn’t find that wishlist. Refresh the page and try again.'
    );
  }

  return token;
}

export async function revokeWishlistShareLink(
  db: D1Database,
  actorMemberId: string,
  shareLinkId: string
): Promise<void> {
  const actorId = requireUuid(actorMemberId, 'The signed-in member');
  const targetShareLinkId = requireUuid(shareLinkId, 'The viewing link');
  const result = await db
    .prepare(
      `DELETE FROM wishlist_share_links
       WHERE id = ?1
         AND EXISTS (SELECT 1 FROM members WHERE id = ?2 AND disabled_at IS NULL)`
    )
    .bind(targetShareLinkId, actorId)
    .run();

  if (!result.success) {
    throw new SharedWishlistInputError('We couldn’t stop sharing that wishlist. Try again.');
  }
}

export function normaliseSharedWishlistIds(values: readonly unknown[]): string[] {
  if (!values.length) throw new SharedWishlistInputError('Choose at least one wishlist to share.');
  if (values.length > 50)
    throw new SharedWishlistInputError('Choose up to 50 wishlists at a time.');
  return [...new Set(values.map((value) => requireUuid(value, 'The wishlist').toLowerCase()))];
}

export async function listShareableWishlists(
  db: D1Database,
  actorMemberId: string
): Promise<ShareableWishlist[]> {
  const actorId = requireUuid(actorMemberId, 'The signed-in member');
  const { results } = await db
    .prepare(
      `SELECT wishlists.id, owners.display_name AS ownerDisplayName
     FROM wishlists
     INNER JOIN members AS owners ON owners.id = wishlists.owner_member_id
     WHERE owners.disabled_at IS NULL AND EXISTS (
       SELECT 1 FROM members WHERE id = ?1 AND disabled_at IS NULL
     )
     ORDER BY owners.display_name COLLATE NOCASE, wishlists.id`
    )
    .bind(actorId)
    .all<ShareableWishlist>();
  return results;
}

export async function listActiveFamilyShareLinks(
  db: D1Database,
  actorMemberId: string
): Promise<ActiveFamilyShareLink[]> {
  const actorId = requireUuid(actorMemberId, 'The signed-in member');
  const { results } = await db
    .prepare(
      `SELECT links.id, links.name, creators.display_name AS createdByDisplayName,
       links.created_at AS createdAt, wishlists.id AS wishlistId,
       owners.display_name AS ownerDisplayName
     FROM family_share_links AS links
     INNER JOIN members AS creators ON creators.id = links.created_by_member_id
     LEFT JOIN family_share_link_wishlists AS selected ON selected.share_link_id = links.id
     LEFT JOIN wishlists ON wishlists.id = selected.wishlist_id
     LEFT JOIN members AS owners ON owners.id = wishlists.owner_member_id
     WHERE EXISTS (
       SELECT 1 FROM members WHERE id = ?1 AND disabled_at IS NULL
     )
     ORDER BY links.created_at DESC, links.id DESC, owners.display_name COLLATE NOCASE, wishlists.id`
    )
    .bind(actorId)
    .all<
      Omit<ActiveFamilyShareLink, 'wishlists'> & {
        wishlistId: string | null;
        ownerDisplayName: string | null;
      }
    >();
  const links = new Map<string, ActiveFamilyShareLink>();
  for (const row of results) {
    let link = links.get(row.id);
    if (!link) {
      link = {
        id: row.id,
        name: row.name,
        createdByDisplayName: row.createdByDisplayName,
        createdAt: row.createdAt,
        wishlists: []
      };
      links.set(row.id, link);
    }
    if (row.wishlistId && row.ownerDisplayName) {
      link.wishlists.push({ id: row.wishlistId, ownerDisplayName: row.ownerDisplayName });
    }
  }
  return [...links.values()];
}

export async function createFamilyShareLink(
  db: D1Database,
  actorMemberId: string,
  wishlistIds: readonly unknown[],
  name: unknown
): Promise<{ token: string; shareLinkId: string }> {
  const actorId = requireUuid(actorMemberId, 'The signed-in member');
  const selectedIds = normaliseSharedWishlistIds(wishlistIds);
  const linkName = normaliseWishlistShareLinkName(name);
  const shareLinkId = crypto.randomUUID();
  const token = makeShareToken();
  const hash = await hashShareToken(token);
  const selection = JSON.stringify(selectedIds);
  // D1 batches are transactions: the token and its complete selection commit together.
  // The conditional insert checks availability and the limit inside that transaction.
  const [linkResult] = await db.batch([
    db
      .prepare(
        `INSERT INTO family_share_links (id, name, token_hash, created_by_member_id)
       SELECT ?1, ?2, ?3, members.id FROM members
       WHERE members.id = ?4 AND members.disabled_at IS NULL
         AND ((SELECT COUNT(*) FROM wishlist_share_links) +
              (SELECT COUNT(*) FROM family_share_links)) < 5
         AND (
           SELECT COUNT(*) FROM wishlists
           INNER JOIN members AS owners ON owners.id = wishlists.owner_member_id
           WHERE wishlists.id IN (SELECT value FROM json_each(?5)) AND owners.disabled_at IS NULL
         ) = ?6`
      )
      .bind(shareLinkId, linkName, hash, actorId, selection, selectedIds.length),
    db
      .prepare(
        `INSERT INTO family_share_link_wishlists (share_link_id, wishlist_id)
       SELECT links.id, selected.value
       FROM family_share_links AS links, json_each(?2) AS selected
       WHERE links.id = ?1`
      )
      .bind(shareLinkId, selection)
  ]);
  if (!linkResult?.success || linkResult.meta.changes !== 1) {
    throw new SharedWishlistInputError(
      'We couldn’t create this link. Check the selected wishlists are available and that fewer than five sharing links are active.'
    );
  }
  return { token, shareLinkId };
}

export async function revokeFamilyShareLink(
  db: D1Database,
  actorMemberId: string,
  shareLinkId: unknown
): Promise<void> {
  const actorId = requireUuid(actorMemberId, 'The signed-in member');
  const linkId = requireUuid(shareLinkId, 'The viewing link');
  const result = await db
    .prepare(
      `DELETE FROM family_share_links WHERE id = ?1 AND EXISTS (
       SELECT 1 FROM members WHERE id = ?2 AND disabled_at IS NULL
     )`
    )
    .bind(linkId, actorId)
    .run();
  if (!result.success)
    throw new SharedWishlistInputError('We couldn’t stop sharing this link. Try again.');
}

export async function listActiveShareLinks(
  db: D1Database,
  actorMemberId: string
): Promise<ActiveFamilyShareLink[]> {
  const [groups, singles, visibleWishlists] = await Promise.all([
    listActiveFamilyShareLinks(db, actorMemberId),
    listActiveWishlistShareLinks(db, actorMemberId),
    listShareableWishlists(db, actorMemberId)
  ]);
  const visibleIds = new Set(visibleWishlists.map((wishlist) => wishlist.id));
  return [
    ...groups.map((link) => ({
      ...link,
      wishlists: link.wishlists.filter((wishlist) => visibleIds.has(wishlist.id))
    })),
    ...singles.map((link) => ({
      id: link.id,
      name: link.name,
      createdByDisplayName: link.createdByDisplayName,
      createdAt: link.createdAt,
      wishlists: visibleIds.has(link.wishlistId)
        ? [{ id: link.wishlistId, ownerDisplayName: link.ownerDisplayName }]
        : []
    }))
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
}

export async function revokeShareLink(
  db: D1Database,
  actorMemberId: string,
  shareLinkId: unknown
): Promise<void> {
  const actorId = requireUuid(actorMemberId, 'The signed-in member');
  const linkId = requireUuid(shareLinkId, 'The viewing link');
  const results = await db.batch([
    db
      .prepare(
        `DELETE FROM wishlist_share_links WHERE id = ?1 AND EXISTS (
      SELECT 1 FROM members WHERE id = ?2 AND disabled_at IS NULL
    )`
      )
      .bind(linkId, actorId),
    db
      .prepare(
        `DELETE FROM family_share_links WHERE id = ?1 AND EXISTS (
      SELECT 1 FROM members WHERE id = ?2 AND disabled_at IS NULL
    )`
      )
      .bind(linkId, actorId)
  ]);
  if (results.some((result) => !result.success))
    throw new SharedWishlistInputError('We couldn’t stop sharing this link. Try again.');
}

// Both link types grant the same item-scoped guest permissions.
export const SHARED_WISHLIST_IDS = `
  SELECT wishlist_id FROM wishlist_share_links WHERE token_hash = ?1
  UNION
  SELECT selected.wishlist_id FROM family_share_links AS links
  INNER JOIN family_share_link_wishlists AS selected ON selected.share_link_id = links.id
  WHERE links.token_hash = ?1
`;

export async function getSharedWishlist(
  db: D1Database,
  token: unknown
): Promise<SharedWishlist | null> {
  const wishlists = await getSharedWishlists(db, token);
  return wishlists[0] ?? null;
}

export async function getSharedWishlists(
  db: D1Database,
  token: unknown,
  guestHash: string | null = null
): Promise<SharedWishlist[]> {
  const hash = await tokenHash(token);
  const { results } = await db
    .prepare(
      `WITH shared_wishlist_ids AS (${SHARED_WISHLIST_IDS})
       SELECT
         wishlists.id AS wishlist_id,
         members.display_name AS owner_display_name,
         items.id AS item_id,
         items.title AS item_title,
         items.notes AS item_notes,
         items.product_url AS item_product_url,
         items.image_url AS item_image_url,
         items.price_amount_minor AS item_price_amount_minor,
         items.price_currency AS item_price_currency,
         items.priority AS item_priority,
         claims.item_id IS NOT NULL AS reserved,
         CASE WHEN claims.guest_token_hash = ?2 THEN claims.state ELSE NULL END AS own_claim_state
       FROM shared_wishlist_ids
       INNER JOIN wishlists ON wishlists.id = shared_wishlist_ids.wishlist_id
       INNER JOIN members ON members.id = wishlists.owner_member_id
       LEFT JOIN items ON items.wishlist_id = wishlists.id
       LEFT JOIN claims ON claims.item_id = items.id
       WHERE members.disabled_at IS NULL
       ORDER BY
         members.display_name COLLATE NOCASE,
         wishlists.id,
         CASE items.priority
           WHEN 'high' THEN 0
           WHEN 'normal' THEN 1
           ELSE 2
         END,
         items.created_at DESC,
         items.id DESC`
    )
    .bind(hash, guestHash)
    .all<SharedWishlistRow>();

  const wishlists = new Map<string, SharedWishlist>();
  for (const row of results) {
    let wishlist = wishlists.get(row.wishlist_id);
    if (!wishlist) {
      wishlist = { id: row.wishlist_id, ownerDisplayName: row.owner_display_name, items: [] };
      wishlists.set(row.wishlist_id, wishlist);
    }
    if (row.item_id && row.item_title && row.item_priority) {
      wishlist.items.push({
        id: row.item_id,
        title: row.item_title,
        notes: row.item_notes,
        productUrl: row.item_product_url,
        imageUrl: normaliseProductImageUrl(row.item_image_url),
        priceAmountMinor: row.item_price_amount_minor,
        priceCurrency: row.item_price_currency,
        reservation:
          row.own_claim_state === 'purchased'
            ? 'bought'
            : row.own_claim_state === 'claimed'
              ? 'yours'
              : row.reserved
                ? 'reserved'
                : 'available',
        priority: row.item_priority
      });
    }
  }
  return [...wishlists.values()];
}
