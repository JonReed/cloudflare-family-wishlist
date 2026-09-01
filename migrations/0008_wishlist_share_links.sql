CREATE TABLE wishlist_share_links (
  wishlist_id TEXT PRIMARY KEY NOT NULL,
  token_hash TEXT NOT NULL UNIQUE CHECK (
    length(token_hash) = 64
    AND token_hash = lower(token_hash)
    AND token_hash NOT GLOB '*[^0-9a-f]*'
  ),
  created_by_member_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (wishlist_id) REFERENCES wishlists(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_member_id) REFERENCES members(id) ON DELETE RESTRICT
) STRICT;

CREATE TABLE shared_image_fetch_limits (
  wishlist_id TEXT PRIMARY KEY NOT NULL,
  minute_started_at INTEGER NOT NULL,
  minute_request_count INTEGER NOT NULL CHECK (
    minute_request_count BETWEEN 1 AND 60
  ),
  day_started_at INTEGER NOT NULL,
  day_request_count INTEGER NOT NULL CHECK (
    day_request_count BETWEEN 1 AND 500
  ),
  FOREIGN KEY (wishlist_id) REFERENCES wishlists(id) ON DELETE CASCADE
) STRICT;
