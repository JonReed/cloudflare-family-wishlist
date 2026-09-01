import { normaliseProductImageUrl, normaliseProductUrl } from '../product-url';

export const ITEM_PRIORITIES = ['low', 'normal', 'high'] as const;
export const CLAIM_STATES = ['claimed', 'purchased'] as const;

export type ItemPriority = (typeof ITEM_PRIORITIES)[number];
export type ClaimState = (typeof CLAIM_STATES)[number];

type ClaimDetails = {
  state: ClaimState;
  claimedByMemberId: string;
  claimedByDisplayName: string;
  isClaimedByViewer: boolean;
};

type WishlistItemBase = {
  id: string;
  title: string;
  notes: string | null;
  productUrl: string | null;
  imageUrl: string | null;
  priceAmountMinor: number | null;
  priceCurrency: string | null;
  priority: ItemPriority;
  position: number;
};

export type WishlistItem = WishlistItemBase &
  ({ claimVisibility: 'hidden' } | { claimVisibility: 'visible'; claim: ClaimDetails | null });

export type FamilyWishlist = {
  id: string;
  owner: {
    id: string;
    displayName: string;
  };
  isOwn: boolean;
  items: WishlistItem[];
};

export type ItemInput = {
  title: FormDataEntryValue | null;
  notes: FormDataEntryValue | null;
  productUrl: FormDataEntryValue | null;
  imageUrl: FormDataEntryValue | null;
  price: FormDataEntryValue | null;
  priority: FormDataEntryValue | null;
};

type WishlistRow = {
  wishlist_id: string;
  owner_member_id: string;
  owner_display_name: string;
  item_id: string | null;
  item_title: string | null;
  item_notes: string | null;
  item_product_url: string | null;
  item_image_url: string | null;
  item_price_amount_minor: number | null;
  item_price_currency: string | null;
  item_priority: ItemPriority | null;
  item_position: number | null;
  claim_state: ClaimState | null;
  claimed_by_member_id: string | null;
  claimed_by_display_name: string | null;
};

type NormalisedItemInput = {
  title: string;
  notes: string | null;
  productUrl: string | null;
  imageUrl: string | null;
  priceAmountMinor: number | null;
  priceCurrency: 'GBP' | null;
  priority: ItemPriority;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const LIST_FAMILY_WISHLISTS = `
  SELECT
    wishlists.id AS wishlist_id,
    members.id AS owner_member_id,
    members.display_name AS owner_display_name,
    items.id AS item_id,
    items.title AS item_title,
    items.notes AS item_notes,
    items.product_url AS item_product_url,
    items.image_url AS item_image_url,
    items.price_amount_minor AS item_price_amount_minor,
    items.price_currency AS item_price_currency,
    items.priority AS item_priority,
    items.position AS item_position,
    claims.state AS claim_state,
    claims.claimed_by_member_id,
    claimants.display_name AS claimed_by_display_name
  FROM wishlists
  INNER JOIN members ON members.id = wishlists.owner_member_id
  LEFT JOIN items ON items.wishlist_id = wishlists.id
  LEFT JOIN claims
    ON claims.item_id = items.id
    AND wishlists.owner_member_id <> ?1
  LEFT JOIN members AS claimants ON claimants.id = claims.claimed_by_member_id
  ORDER BY
    CASE WHEN wishlists.owner_member_id = ?1 THEN 0 ELSE 1 END,
    members.display_name COLLATE NOCASE,
    CASE items.priority
      WHEN 'high' THEN 0
      WHEN 'normal' THEN 1
      ELSE 2
    END,
    items.created_at DESC,
    items.id DESC
`;

export class WishlistInputError extends Error {}

function requireUuid(value: unknown, label: string): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new WishlistInputError(`${label} is invalid.`);
  }

  return value;
}

function requireString(value: FormDataEntryValue | null, label: string): string {
  if (typeof value !== 'string') {
    throw new WishlistInputError(`${label} is required.`);
  }

  return value;
}

function normaliseItemInput(input: ItemInput): NormalisedItemInput {
  const title = requireString(input.title, 'A name for the wish').trim();
  if (title.length < 1 || title.length > 160) {
    throw new WishlistInputError('Give the wish a name between 1 and 160 characters.');
  }

  const notesValue = requireString(input.notes, 'Notes').trim();
  if (notesValue.length > 2000) {
    throw new WishlistInputError('Keep the extra details to 2,000 characters or fewer.');
  }

  const productUrlValue = requireString(input.productUrl, 'A link').trim();
  const productUrl = normaliseProductUrl(productUrlValue);
  if (productUrlValue && !productUrl) {
    throw new WishlistInputError(
      'That link doesn’t look right. Use an address beginning with http:// or https://.'
    );
  }

  const imageUrlValue = requireString(input.imageUrl, 'A picture link').trim();
  const imageUrl = normaliseProductImageUrl(imageUrlValue);
  if (imageUrlValue && !imageUrl) {
    throw new WishlistInputError(
      'That picture link doesn’t look right. Use a public address beginning with https://.'
    );
  }

  const priceValue = requireString(input.price, 'The price').trim();
  let priceAmountMinor: number | null = null;
  if (priceValue) {
    const match = /^(0|[1-9]\d{0,6})(?:\.(\d{1,2}))?$/.exec(priceValue);
    if (!match) {
      throw new WishlistInputError('Enter a price in pounds and pence, such as 24.50.');
    }

    const [, pounds, pence = ''] = match;
    priceAmountMinor = Number(pounds) * 100 + Number(pence.padEnd(2, '0'));
  }

  const priority = requireString(input.priority, 'A choice');
  if (!ITEM_PRIORITIES.includes(priority as ItemPriority)) {
    throw new WishlistInputError('Choose how much they’d like it from the options shown.');
  }

  return {
    title,
    notes: notesValue || null,
    productUrl,
    imageUrl,
    priceAmountMinor,
    priceCurrency: priceAmountMinor === null ? null : 'GBP',
    priority: priority as ItemPriority
  };
}

function requireChanged(result: D1Result, message: string): void {
  if (!result.success || result.meta.changes !== 1) {
    throw new WishlistInputError(message);
  }
}

export async function listFamilyWishlists(
  db: D1Database,
  viewerMemberId: string
): Promise<FamilyWishlist[]> {
  const viewerId = requireUuid(viewerMemberId, 'The signed-in member');
  const { results } = await db.prepare(LIST_FAMILY_WISHLISTS).bind(viewerId).all<WishlistRow>();

  const wishlists = new Map<string, FamilyWishlist>();

  for (const row of results) {
    const isOwn = row.owner_member_id === viewerId;
    let wishlist = wishlists.get(row.wishlist_id);

    if (!wishlist) {
      wishlist = {
        id: row.wishlist_id,
        owner: {
          id: row.owner_member_id,
          displayName: row.owner_display_name
        },
        isOwn,
        items: []
      };
      wishlists.set(row.wishlist_id, wishlist);
    }

    if (!row.item_id || !row.item_title || !row.item_priority || row.item_position === null) {
      continue;
    }

    const item: WishlistItemBase = {
      id: row.item_id,
      title: row.item_title,
      notes: row.item_notes,
      productUrl: row.item_product_url,
      imageUrl: row.item_image_url,
      priceAmountMinor: row.item_price_amount_minor,
      priceCurrency: row.item_price_currency,
      priority: row.item_priority,
      position: row.item_position
    };

    if (isOwn) {
      wishlist.items.push({ ...item, claimVisibility: 'hidden' });
      continue;
    }

    const claim =
      row.claim_state && row.claimed_by_member_id && row.claimed_by_display_name
        ? {
            state: row.claim_state,
            claimedByMemberId: row.claimed_by_member_id,
            claimedByDisplayName: row.claimed_by_display_name,
            isClaimedByViewer: row.claimed_by_member_id === viewerId
          }
        : null;

    wishlist.items.push({ ...item, claimVisibility: 'visible', claim });
  }

  return [...wishlists.values()];
}

export async function createWishlistItem(
  db: D1Database,
  actorMemberId: string,
  wishlistId: string,
  input: ItemInput
): Promise<void> {
  const actorId = requireUuid(actorMemberId, 'The signed-in member');
  const targetWishlistId = requireUuid(wishlistId, 'The wishlist');
  const item = normaliseItemInput(input);

  const result = await db
    .prepare(
      `INSERT INTO items (
         id, wishlist_id, title, notes, product_url, image_url,
         price_amount_minor, price_currency, priority, position, created_by_member_id
       )
       SELECT
         ?1, wishlists.id, ?2, ?3, ?4, ?5, ?6, ?7, ?8,
         COALESCE((
           SELECT MAX(existing_items.position) + 1
           FROM items AS existing_items
           WHERE existing_items.wishlist_id = wishlists.id
         ), 0),
         ?9
       FROM wishlists
       WHERE wishlists.id = ?10`
    )
    .bind(
      crypto.randomUUID(),
      item.title,
      item.notes,
      item.productUrl,
      item.imageUrl,
      item.priceAmountMinor,
      item.priceCurrency,
      item.priority,
      actorId,
      targetWishlistId
    )
    .run();

  requireChanged(result, 'We couldn’t find that wishlist. Refresh the page and try again.');
}

export async function createWishlistItems(
  db: D1Database,
  actorMemberId: string,
  wishlistIds: readonly unknown[],
  input: ItemInput
): Promise<void> {
  const actorId = requireUuid(actorMemberId, 'The signed-in member');

  if (wishlistIds.length < 1) {
    throw new WishlistInputError('Choose at least one wishlist.');
  }

  if (wishlistIds.length > 50) {
    throw new WishlistInputError('Choose up to 50 wishlists at a time.');
  }

  const targetWishlistIds = [
    ...new Set(wishlistIds.map((wishlistId) => requireUuid(wishlistId, 'The wishlist')))
  ];
  const item = normaliseItemInput(input);
  const selectedValues = targetWishlistIds.map(() => '(?, ?)').join(', ');
  const selectedBindings = targetWishlistIds.flatMap((wishlistId) => [
    wishlistId,
    crypto.randomUUID()
  ]);

  const result = await db
    .prepare(
      `WITH selected_wishlists (wishlist_id, item_id) AS (
         VALUES ${selectedValues}
       )
       INSERT INTO items (
         id, wishlist_id, title, notes, product_url, image_url,
         price_amount_minor, price_currency, priority, position, created_by_member_id
       )
       SELECT
         selected_wishlists.item_id,
         wishlists.id,
         ?, ?, ?, ?, ?, ?, ?,
         COALESCE((
           SELECT MAX(existing_items.position) + 1
           FROM items AS existing_items
           WHERE existing_items.wishlist_id = wishlists.id
         ), 0),
         ?
       FROM selected_wishlists
       INNER JOIN wishlists ON wishlists.id = selected_wishlists.wishlist_id
       WHERE (
         SELECT COUNT(*)
         FROM selected_wishlists AS requested_wishlists
       ) = (
         SELECT COUNT(*)
         FROM selected_wishlists AS available_wishlists
         INNER JOIN wishlists AS existing_wishlists
           ON existing_wishlists.id = available_wishlists.wishlist_id
       )`
    )
    .bind(
      ...selectedBindings,
      item.title,
      item.notes,
      item.productUrl,
      item.imageUrl,
      item.priceAmountMinor,
      item.priceCurrency,
      item.priority,
      actorId
    )
    .run();

  if (!result.success || result.meta.changes !== targetWishlistIds.length) {
    throw new WishlistInputError(
      'We couldn’t find every wishlist. Refresh the page and choose them again.'
    );
  }
}

export async function updateWishlistItem(
  db: D1Database,
  itemId: string,
  input: ItemInput
): Promise<void> {
  const targetItemId = requireUuid(itemId, 'The item');
  const item = normaliseItemInput(input);

  const result = await db
    .prepare(
      `UPDATE items
       SET
         title = ?1,
         notes = ?2,
         product_url = ?3,
         image_url = ?4,
         price_amount_minor = ?5,
         price_currency = ?6,
         priority = ?7,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ?8`
    )
    .bind(
      item.title,
      item.notes,
      item.productUrl,
      item.imageUrl,
      item.priceAmountMinor,
      item.priceCurrency,
      item.priority,
      targetItemId
    )
    .run();

  requireChanged(result, 'We couldn’t find that wish. It may have been removed.');
}

export async function deleteWishlistItem(db: D1Database, itemId: string): Promise<void> {
  const targetItemId = requireUuid(itemId, 'The item');
  const result = await db.prepare('DELETE FROM items WHERE id = ?1').bind(targetItemId).run();

  requireChanged(result, 'We couldn’t find that wish. It may have been removed.');
}

export async function claimWishlistItem(
  db: D1Database,
  actorMemberId: string,
  itemId: string
): Promise<void> {
  const actorId = requireUuid(actorMemberId, 'The signed-in member');
  const targetItemId = requireUuid(itemId, 'The item');

  const result = await db
    .prepare(
      `INSERT INTO claims (item_id, claimed_by_member_id)
       SELECT items.id, ?1
       FROM items
       INNER JOIN wishlists ON wishlists.id = items.wishlist_id
       WHERE items.id = ?2
         AND wishlists.owner_member_id <> ?1
       ON CONFLICT (item_id) DO NOTHING`
    )
    .bind(actorId, targetItemId)
    .run();

  requireChanged(result, 'Someone may already be getting this, or it may be on your own wishlist.');
}

export async function setOwnClaimState(
  db: D1Database,
  actorMemberId: string,
  itemId: string,
  state: ClaimState
): Promise<void> {
  const actorId = requireUuid(actorMemberId, 'The signed-in member');
  const targetItemId = requireUuid(itemId, 'The item');

  if (!CLAIM_STATES.includes(state)) {
    throw new WishlistInputError('We couldn’t update this gift. Refresh the page and try again.');
  }

  const result = await db
    .prepare(
      `UPDATE claims
       SET state = ?1, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE item_id = ?2 AND claimed_by_member_id = ?3`
    )
    .bind(state, targetItemId, actorId)
    .run();

  requireChanged(result, 'Only the person getting this gift can mark it as bought.');
}

export async function unclaimWishlistItem(
  db: D1Database,
  actorMemberId: string,
  itemId: string
): Promise<void> {
  const actorId = requireUuid(actorMemberId, 'The signed-in member');
  const targetItemId = requireUuid(itemId, 'The item');
  const result = await db
    .prepare('DELETE FROM claims WHERE item_id = ?1 AND claimed_by_member_id = ?2')
    .bind(targetItemId, actorId)
    .run();

  requireChanged(result, 'Only the person getting this gift can leave it for someone else.');
}
