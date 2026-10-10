-- Keep existing counters while allowing application guards to size limits to a whole list.
-- The previous Worker remains compatible with these wider positive-count constraints.
CREATE TABLE shared_image_fetch_limits_next (
  wishlist_id TEXT PRIMARY KEY NOT NULL,
  minute_started_at INTEGER NOT NULL,
  minute_request_count INTEGER NOT NULL CHECK (minute_request_count >= 1),
  day_started_at INTEGER NOT NULL,
  day_request_count INTEGER NOT NULL CHECK (day_request_count >= 1),
  FOREIGN KEY (wishlist_id) REFERENCES wishlists(id) ON DELETE CASCADE
) STRICT;

INSERT INTO shared_image_fetch_limits_next
  SELECT * FROM shared_image_fetch_limits;
DROP TABLE shared_image_fetch_limits;
ALTER TABLE shared_image_fetch_limits_next RENAME TO shared_image_fetch_limits;

CREATE TABLE shared_image_requester_limits_next (
  wishlist_id TEXT NOT NULL,
  requester_hash TEXT NOT NULL CHECK (
    length(requester_hash) = 64
    AND requester_hash = lower(requester_hash)
    AND requester_hash NOT GLOB '*[^0-9a-f]*'
  ),
  minute_started_at INTEGER NOT NULL,
  minute_request_count INTEGER NOT NULL CHECK (minute_request_count >= 1),
  day_started_at INTEGER NOT NULL,
  day_request_count INTEGER NOT NULL CHECK (day_request_count >= 1),
  PRIMARY KEY (wishlist_id, requester_hash),
  FOREIGN KEY (wishlist_id) REFERENCES wishlists(id) ON DELETE CASCADE
) STRICT;

INSERT INTO shared_image_requester_limits_next
  SELECT * FROM shared_image_requester_limits;
DROP TABLE shared_image_requester_limits;
ALTER TABLE shared_image_requester_limits_next RENAME TO shared_image_requester_limits;

CREATE INDEX shared_image_requester_limits_day
  ON shared_image_requester_limits (wishlist_id, day_started_at);
