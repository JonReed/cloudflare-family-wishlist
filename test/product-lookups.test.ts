import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  consumeProductLookupBudget,
  type ProductLookupRateLimitError
} from '../app/lib/db/product-lookups';
import { ensureMemberForEmail } from '../app/lib/db/members';

describe('product lookup budget', () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM product_lookup_limits'),
      env.DB.prepare('DELETE FROM claims'),
      env.DB.prepare('DELETE FROM items'),
      env.DB.prepare('DELETE FROM wishlists'),
      env.DB.prepare('DELETE FROM family_invitations'),
      env.DB.prepare('DELETE FROM members')
    ]);
  });

  it('allows the family-sized burst and rejects the next lookup', async () => {
    const member = await ensureMemberForEmail(env.DB, 'admin@example.com');
    const now = 1_800_000_000;

    for (let index = 0; index < 12; index += 1) {
      await consumeProductLookupBudget(env.DB, member.id, now);
    }

    await expect(consumeProductLookupBudget(env.DB, member.id, now)).rejects.toMatchObject({
      retryAfterSeconds: 60
    } satisfies Partial<ProductLookupRateLimitError>);
  });

  it('starts a fresh budget in the next minute window', async () => {
    const member = await ensureMemberForEmail(env.DB, 'admin@example.com');
    const now = 1_800_000_000;

    for (let index = 0; index < 12; index += 1) {
      await consumeProductLookupBudget(env.DB, member.id, now);
    }

    await expect(consumeProductLookupBudget(env.DB, member.id, now + 60)).resolves.toBeUndefined();
  });

  it('keeps concurrent updates within the database constraint', async () => {
    const member = await ensureMemberForEmail(env.DB, 'admin@example.com');
    const outcomes = await Promise.allSettled(
      Array.from({ length: 16 }, () => consumeProductLookupBudget(env.DB, member.id, 1_800_000_000))
    );

    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(12);
    expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(4);
  });
});
