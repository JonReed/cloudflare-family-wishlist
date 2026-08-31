ALTER TABLE members
  ADD COLUMN role TEXT NOT NULL DEFAULT 'member'
  CHECK (role IN ('admin', 'member'));

UPDATE members
SET role = 'admin'
WHERE id = (
  SELECT id
  FROM members
  ORDER BY created_at, id
  LIMIT 1
);

CREATE INDEX members_role_idx ON members (role);

CREATE TABLE family_invitations (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name TEXT NOT NULL CHECK (
    length(trim(display_name)) BETWEEN 1 AND 80
  ),
  access_policy_id TEXT NOT NULL UNIQUE,
  invited_by_member_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (invited_by_member_id) REFERENCES members(id) ON DELETE RESTRICT
) STRICT;

CREATE INDEX family_invitations_invited_by_idx
  ON family_invitations (invited_by_member_id);
