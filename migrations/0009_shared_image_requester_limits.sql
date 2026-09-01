CREATE TABLE shared_image_requester_limits (
  wishlist_id TEXT NOT NULL,
  requester_hash TEXT NOT NULL CHECK (
    length(requester_hash) = 64
    AND requester_hash = lower(requester_hash)
    AND requester_hash NOT GLOB '*[^0-9a-f]*'
  ),
  minute_started_at INTEGER NOT NULL,
  minute_request_count INTEGER NOT NULL CHECK (
    minute_request_count BETWEEN 1 AND 20
  ),
  day_started_at INTEGER NOT NULL,
  day_request_count INTEGER NOT NULL CHECK (
    day_request_count BETWEEN 1 AND 100
  ),
  PRIMARY KEY (wishlist_id, requester_hash),
  FOREIGN KEY (wishlist_id) REFERENCES wishlists(id) ON DELETE CASCADE
) STRICT;

CREATE INDEX shared_image_requester_limits_day
  ON shared_image_requester_limits (wishlist_id, day_started_at);
