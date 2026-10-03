CREATE TABLE family_share_links (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  token_hash TEXT NOT NULL UNIQUE CHECK (
    length(token_hash) = 64
    AND token_hash = lower(token_hash)
    AND token_hash NOT GLOB '*[^0-9a-f]*'
  ),
  created_by_member_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (created_by_member_id) REFERENCES members(id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE family_share_link_wishlists (
  share_link_id TEXT NOT NULL,
  wishlist_id TEXT NOT NULL,
  PRIMARY KEY (share_link_id, wishlist_id),
  FOREIGN KEY (share_link_id) REFERENCES family_share_links(id) ON DELETE CASCADE,
  FOREIGN KEY (wishlist_id) REFERENCES wishlists(id) ON DELETE CASCADE
) STRICT;

CREATE INDEX family_share_link_wishlists_wishlist_idx
  ON family_share_link_wishlists (wishlist_id);
