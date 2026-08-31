export type MemberWithWishlist = {
  id: string;
  email: string;
  displayName: string;
  wishlistId: string;
};

type MemberWithWishlistRow = {
  id: string;
  email: string;
  display_name: string;
  wishlist_id: string;
};

const FIND_MEMBER_WITH_WISHLIST = `
  SELECT
    members.id,
    members.email,
    members.display_name,
    wishlists.id AS wishlist_id
  FROM members
  INNER JOIN wishlists ON wishlists.owner_member_id = members.id
  WHERE members.email = ?1 COLLATE NOCASE
  LIMIT 1
`;

function normaliseEmail(value: string): string {
  const email = value.trim().toLowerCase();

  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('The authenticated identity did not contain a valid email address.');
  }

  return email;
}

function initialDisplayName(email: string): string {
  const [localPart = 'Family member'] = email.split('@', 1);
  const readable = localPart
    .replace(/[._+-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return readable.slice(0, 80) || 'Family member';
}

function mapMember(row: MemberWithWishlistRow): MemberWithWishlist {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    wishlistId: row.wishlist_id
  };
}

async function findMemberWithWishlist(
  db: D1Database,
  email: string
): Promise<MemberWithWishlist | null> {
  const row = await db
    .prepare(FIND_MEMBER_WITH_WISHLIST)
    .bind(email)
    .first<MemberWithWishlistRow>();

  return row ? mapMember(row) : null;
}

/**
 * Provisions the one member/one wishlist pair after Access has authenticated an
 * identity. Unique constraints make concurrent first requests idempotent.
 */
export async function ensureMemberForEmail(
  db: D1Database,
  identityEmail: string
): Promise<MemberWithWishlist> {
  const email = normaliseEmail(identityEmail);
  const existing = await findMemberWithWishlist(db, email);

  if (existing) {
    return existing;
  }

  const memberId = crypto.randomUUID();
  const wishlistId = crypto.randomUUID();

  await db.batch([
    db
      .prepare(
        `INSERT INTO members (id, email, display_name)
         VALUES (?1, ?2, ?3)
         ON CONFLICT (email) DO NOTHING`
      )
      .bind(memberId, email, initialDisplayName(email)),
    db
      .prepare(
        `INSERT INTO wishlists (id, owner_member_id)
         SELECT ?1, members.id
         FROM members
         WHERE members.email = ?2 COLLATE NOCASE
         ON CONFLICT (owner_member_id) DO NOTHING`
      )
      .bind(wishlistId, email)
  ]);

  const member = await findMemberWithWishlist(db, email);

  if (!member) {
    throw new Error('Member provisioning did not produce a wishlist.');
  }

  return member;
}
