-- Preserve member reservations while allowing one guest or member claimant per item.
CREATE TABLE claims_with_guests (
  item_id TEXT PRIMARY KEY NOT NULL,
  claimed_by_member_id TEXT,
  guest_token_hash TEXT,
  state TEXT NOT NULL DEFAULT 'claimed' CHECK (state IN ('claimed', 'purchased')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK ((claimed_by_member_id IS NOT NULL AND guest_token_hash IS NULL)
      OR (claimed_by_member_id IS NULL AND guest_token_hash IS NOT NULL AND length(guest_token_hash) = 64)),
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  FOREIGN KEY (claimed_by_member_id) REFERENCES members(id) ON DELETE RESTRICT
) STRICT;
INSERT INTO claims_with_guests (item_id, claimed_by_member_id, state, created_at, updated_at)
SELECT item_id, claimed_by_member_id, state, created_at, updated_at FROM claims;
DROP TABLE claims;
ALTER TABLE claims_with_guests RENAME TO claims;
CREATE INDEX claims_member_idx ON claims (claimed_by_member_id);
CREATE INDEX claims_guest_idx ON claims (guest_token_hash);

CREATE TABLE guest_claim_limits (
  scope TEXT PRIMARY KEY NOT NULL,
  hour INTEGER NOT NULL,
  attempts INTEGER NOT NULL
) STRICT;
