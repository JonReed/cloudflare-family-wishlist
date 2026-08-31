export const MEMBER_ROLES = ['admin', 'member'] as const;

export type MemberRole = (typeof MEMBER_ROLES)[number];

export type MemberWithWishlist = {
  id: string;
  email: string;
  displayName: string;
  role: MemberRole;
  wishlistId: string;
};

export class MemberInputError extends Error {}

type MemberWithWishlistRow = {
  id: string;
  email: string;
  display_name: string;
  role: MemberRole;
  wishlist_id: string;
};

const FIND_MEMBER_WITH_WISHLIST = `
  SELECT
    members.id,
    members.email,
    members.display_name,
    members.role,
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

function normaliseDisplayName(value: FormDataEntryValue | null): string {
  if (typeof value !== 'string') {
    throw new MemberInputError('Enter the name you would like your family to see.');
  }

  const displayName = value.replace(/\s+/g, ' ').trim();

  if (!displayName) {
    throw new MemberInputError('Enter the name you would like your family to see.');
  }

  if (displayName.length > 80) {
    throw new MemberInputError('Keep your display name to 80 characters or fewer.');
  }

  return displayName;
}

function mapMember(row: MemberWithWishlistRow): MemberWithWishlist {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
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
        `INSERT INTO members (id, email, display_name, role)
         VALUES (
           ?1,
           ?2,
           COALESCE(
             (
               SELECT family_invitations.display_name
               FROM family_invitations
               WHERE family_invitations.email = ?2 COLLATE NOCASE
               LIMIT 1
             ),
             ?3
           ),
           CASE
             WHEN EXISTS (SELECT 1 FROM members) THEN 'member'
             ELSE 'admin'
           END
         )
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

/** Updates only the member already resolved from the authenticated Access identity. */
export async function updateMemberDisplayName(
  db: D1Database,
  memberId: string,
  value: FormDataEntryValue | null
): Promise<string> {
  const displayName = normaliseDisplayName(value);
  const result = await db
    .prepare(
      `UPDATE members
       SET
         display_name = ?1,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ?2`
    )
    .bind(displayName, memberId)
    .run();

  if (!result.success || result.meta.changes !== 1) {
    throw new MemberInputError('We couldn’t find your profile. Refresh the page and try again.');
  }

  return displayName;
}
