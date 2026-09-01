CREATE INDEX items_wishlist_priority_created_idx
  ON items (
    wishlist_id,
    (
      CASE priority
        WHEN 'high' THEN 0
        WHEN 'normal' THEN 1
        ELSE 2
      END
    ),
    created_at DESC,
    id DESC
  );

PRAGMA optimize;
