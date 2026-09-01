CREATE TABLE product_lookup_limits (
  member_id TEXT PRIMARY KEY NOT NULL,
  window_started_at INTEGER NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count BETWEEN 1 AND 12),
  FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
) STRICT;
