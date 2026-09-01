import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  consumeProductImageBudget,
  type ProductImageRateLimitError
} from '../app/lib/db/product-images';
import { ensureMemberForEmail } from '../app/lib/db/members';

describe('product image fetch budget', () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM product_image_fetch_limits'),
      env.DB.prepare('DELETE FROM product_lookup_limits'),
      env.DB.prepare('DELETE FROM claims'),
      env.DB.prepare('DELETE FROM items'),
      env.DB.prepare('DELETE FROM wishlists'),
      env.DB.prepare('DELETE FROM family_invitations'),
      env.DB.prepare('DELETE FROM members')
    ]);
  });

  it('enforces the minute burst independently for each member', async () => {
    const member = await ensureMemberForEmail(env.DB, 'admin@example.com', 'admin@example.com');
    const now = 1_800_000_000;
    for (let index = 0; index < 60; index += 1) {
      await consumeProductImageBudget(env.DB, member.id, now);
    }

    await expect(consumeProductImageBudget(env.DB, member.id, now)).rejects.toMatchObject({
      retryAfterSeconds: 60
    } satisfies Partial<ProductImageRateLimitError>);
    await expect(consumeProductImageBudget(env.DB, member.id, now + 60)).resolves.toBeUndefined();
  });

  it('enforces the daily budget across minute windows', async () => {
    const member = await ensureMemberForEmail(env.DB, 'admin@example.com', 'admin@example.com');
    const dayStart = 1_800_057_600;
    for (let index = 0; index < 500; index += 1) {
      await consumeProductImageBudget(env.DB, member.id, dayStart + index * 60);
    }

    await expect(
      consumeProductImageBudget(env.DB, member.id, dayStart + 500 * 60)
    ).rejects.toMatchObject({
      retryAfterSeconds: 56_400
    } satisfies Partial<ProductImageRateLimitError>);
    await expect(
      consumeProductImageBudget(env.DB, member.id, dayStart + 86_400)
    ).resolves.toBeUndefined();
  });
});
