PRAGMA foreign_keys = ON;

CREATE TABLE members (
  id TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  display_name TEXT NOT NULL CHECK (
    length(trim(display_name)) BETWEEN 1 AND 80
  ),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
) STRICT;

CREATE TABLE wishlists (
  id TEXT PRIMARY KEY NOT NULL,
  owner_member_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (owner_member_id) REFERENCES members(id) ON DELETE CASCADE
) STRICT;

CREATE TABLE items (
  id TEXT PRIMARY KEY NOT NULL,
  wishlist_id TEXT NOT NULL,
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 160),
  notes TEXT CHECK (notes IS NULL OR length(notes) <= 2000),
  product_url TEXT CHECK (product_url IS NULL OR length(product_url) <= 2048),
  price_amount_minor INTEGER CHECK (
    price_amount_minor IS NULL OR price_amount_minor >= 0
  ),
  price_currency TEXT CHECK (
    price_currency IS NULL OR (
      length(price_currency) = 3 AND price_currency = upper(price_currency)
    )
  ),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (
    priority IN ('low', 'normal', 'high')
  ),
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_by_member_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (wishlist_id) REFERENCES wishlists(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by_member_id) REFERENCES members(id) ON DELETE RESTRICT
) STRICT;

CREATE INDEX items_wishlist_position_idx
  ON items (wishlist_id, position, created_at);

CREATE TABLE claims (
  item_id TEXT PRIMARY KEY NOT NULL,
  claimed_by_member_id TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'claimed' CHECK (
    state IN ('claimed', 'purchased')
  ),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  FOREIGN KEY (claimed_by_member_id) REFERENCES members(id) ON DELETE RESTRICT
) STRICT;

CREATE INDEX claims_member_idx ON claims (claimed_by_member_id);
