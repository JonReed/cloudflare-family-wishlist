const LOOKUP_LIMIT = 12;
const WINDOW_SECONDS = 60;

export class ProductLookupRateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super('That’s a lot of page lookups at once. Wait a moment, then try again.');
    this.name = 'ProductLookupRateLimitError';
  }
}

/** Consumes one member-scoped product lookup from a concurrency-safe D1 window. */
export async function consumeProductLookupBudget(
  db: D1Database,
  memberId: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): Promise<void> {
  const windowStartedAt = Math.floor(nowSeconds / WINDOW_SECONDS) * WINDOW_SECONDS;
  const result = await db
    .prepare(
      `INSERT INTO product_lookup_limits (member_id, window_started_at, request_count)
       VALUES (?1, ?2, 1)
       ON CONFLICT (member_id) DO UPDATE SET
         window_started_at = CASE
           WHEN product_lookup_limits.window_started_at < excluded.window_started_at
             THEN excluded.window_started_at
           ELSE product_lookup_limits.window_started_at
         END,
         request_count = CASE
           WHEN product_lookup_limits.window_started_at < excluded.window_started_at THEN 1
           ELSE product_lookup_limits.request_count + 1
         END
       WHERE product_lookup_limits.window_started_at < excluded.window_started_at
          OR product_lookup_limits.request_count < ?3`
    )
    .bind(memberId, windowStartedAt, LOOKUP_LIMIT)
    .run();

  if (!result.success || result.meta.changes !== 1) {
    const retryAfterSeconds = Math.max(1, windowStartedAt + WINDOW_SECONDS - nowSeconds);
    throw new ProductLookupRateLimitError(retryAfterSeconds);
  }
}
