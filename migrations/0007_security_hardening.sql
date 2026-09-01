PRAGMA defer_foreign_keys = ON;

ALTER TABLE members ADD COLUMN disabled_at TEXT;

CREATE TABLE family_invitations_next (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name TEXT NOT NULL CHECK (
    length(trim(display_name)) BETWEEN 1 AND 80
  ),
  access_policy_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (
      status IN (
        'pending',
        'active',
        'cleanup_required',
        'revocation_required',
        'revoked'
      )
    ),
  invited_by_member_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK (
    (status = 'pending' AND access_policy_id IS NULL)
    OR (
      status IN ('active', 'cleanup_required', 'revocation_required')
      AND access_policy_id IS NOT NULL
    )
    OR (status = 'revoked' AND access_policy_id IS NULL)
  ),
  FOREIGN KEY (invited_by_member_id) REFERENCES members(id) ON DELETE RESTRICT
) STRICT;

INSERT INTO family_invitations_next (
  id,
  email,
  display_name,
  access_policy_id,
  status,
  invited_by_member_id,
  created_at
)
SELECT
  id,
  email,
  display_name,
  access_policy_id,
  status,
  invited_by_member_id,
  created_at
FROM family_invitations;

DROP TABLE family_invitations;
ALTER TABLE family_invitations_next RENAME TO family_invitations;

CREATE INDEX family_invitations_invited_by_idx
  ON family_invitations (invited_by_member_id);

CREATE INDEX family_invitations_status_idx
  ON family_invitations (status, created_at);

CREATE TABLE product_image_fetch_limits (
  member_id TEXT PRIMARY KEY NOT NULL,
  minute_started_at INTEGER NOT NULL,
  minute_request_count INTEGER NOT NULL CHECK (
    minute_request_count BETWEEN 1 AND 60
  ),
  day_started_at INTEGER NOT NULL,
  day_request_count INTEGER NOT NULL CHECK (
    day_request_count BETWEEN 1 AND 500
  ),
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
) STRICT;
