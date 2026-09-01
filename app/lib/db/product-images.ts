const MINUTE_LIMIT = 60;
const DAY_LIMIT = 500;
const MINUTE_SECONDS = 60;
const DAY_SECONDS = 86_400;

export class ProductImageRateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super('That’s a lot of pictures at once. Wait a moment, then refresh the page.');
    this.name = 'ProductImageRateLimitError';
  }
}

/** Consumes one member-scoped image fetch from atomic minute and UTC-day budgets. */
export async function consumeProductImageBudget(
  db: D1Database,
  memberId: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): Promise<void> {
  const minuteStartedAt = Math.floor(nowSeconds / MINUTE_SECONDS) * MINUTE_SECONDS;
  const dayStartedAt = Math.floor(nowSeconds / DAY_SECONDS) * DAY_SECONDS;
  const result = await db
    .prepare(
      `INSERT INTO product_image_fetch_limits (
         member_id,
         minute_started_at,
         minute_request_count,
         day_started_at,
         day_request_count
       )
       VALUES (?1, ?2, 1, ?3, 1)
       ON CONFLICT (member_id) DO UPDATE SET
         minute_started_at = CASE
           WHEN product_image_fetch_limits.minute_started_at < excluded.minute_started_at
             THEN excluded.minute_started_at
           ELSE product_image_fetch_limits.minute_started_at
         END,
         minute_request_count = CASE
           WHEN product_image_fetch_limits.minute_started_at < excluded.minute_started_at THEN 1
           ELSE product_image_fetch_limits.minute_request_count + 1
         END,
         day_started_at = CASE
           WHEN product_image_fetch_limits.day_started_at < excluded.day_started_at
             THEN excluded.day_started_at
           ELSE product_image_fetch_limits.day_started_at
         END,
         day_request_count = CASE
           WHEN product_image_fetch_limits.day_started_at < excluded.day_started_at THEN 1
           ELSE product_image_fetch_limits.day_request_count + 1
         END
       WHERE (
         product_image_fetch_limits.minute_started_at < excluded.minute_started_at
         OR product_image_fetch_limits.minute_request_count < ?4
       )
       AND (
         product_image_fetch_limits.day_started_at < excluded.day_started_at
         OR product_image_fetch_limits.day_request_count < ?5
       )`
    )
    .bind(memberId, minuteStartedAt, dayStartedAt, MINUTE_LIMIT, DAY_LIMIT)
    .run();

  if (!result.success || result.meta.changes !== 1) {
    const row = await db
      .prepare(
        `SELECT minute_started_at, minute_request_count, day_started_at, day_request_count
         FROM product_image_fetch_limits
         WHERE member_id = ?1`
      )
      .bind(memberId)
      .first<{
        minute_started_at: number;
        minute_request_count: number;
        day_started_at: number;
        day_request_count: number;
      }>();
    const dailyLimited =
      row?.day_started_at === dayStartedAt && (row?.day_request_count ?? 0) >= DAY_LIMIT;
    const retryAfterSeconds = dailyLimited
      ? Math.max(1, dayStartedAt + DAY_SECONDS - nowSeconds)
      : Math.max(1, minuteStartedAt + MINUTE_SECONDS - nowSeconds);
    throw new ProductImageRateLimitError(retryAfterSeconds);
  }
}
