DROP TABLE wishlist_share_links;

CREATE TABLE wishlist_share_links (
  id TEXT PRIMARY KEY NOT NULL CHECK (length(id) = 36),
  wishlist_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  token_hash TEXT NOT NULL UNIQUE CHECK (
    length(token_hash) = 64
    AND token_hash = lower(token_hash)
    AND token_hash NOT GLOB '*[^0-9a-f]*'
  ),
  created_by_member_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (wishlist_id) REFERENCES wishlists(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_member_id) REFERENCES members(id) ON DELETE RESTRICT
) STRICT;

CREATE INDEX wishlist_share_links_wishlist_id_idx
  ON wishlist_share_links (wishlist_id, created_at DESC, id DESC);

CREATE INDEX wishlist_share_links_creator_idx
  ON wishlist_share_links (created_by_member_id);
