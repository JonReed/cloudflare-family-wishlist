ALTER TABLE members ADD COLUMN first_signed_in_at TEXT;

-- Before this change, a member row could only be created by a first sign-in.
UPDATE members SET first_signed_in_at = created_at;

-- Invitation IDs are already random UUIDs. Reusing one as the new member ID
-- does not change the invitation, its Access policy, or any existing member.
INSERT INTO members (id, email, display_name, role, created_at)
SELECT id, email, display_name, 'member', created_at
FROM family_invitations
WHERE status = 'active' AND access_policy_id IS NOT NULL
ON CONFLICT (email) DO NOTHING;

INSERT INTO wishlists (id, owner_member_id)
SELECT
  lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||
  substr(lower(hex(randomblob(2))), 2) || '-' ||
  substr('89ab', abs(random() % 4) + 1, 1) || substr(lower(hex(randomblob(2))), 2) || '-' ||
  lower(hex(randomblob(6))),
  members.id
FROM members
INNER JOIN family_invitations ON family_invitations.email = members.email COLLATE NOCASE
WHERE family_invitations.status = 'active'
  AND family_invitations.access_policy_id IS NOT NULL
  AND members.disabled_at IS NULL
ON CONFLICT (owner_member_id) DO NOTHING;
