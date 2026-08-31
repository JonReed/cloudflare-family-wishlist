import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { ensureMemberForEmail } from '../app/lib/db/members';

describe('ensureMemberForEmail', () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM claims'),
      env.DB.prepare('DELETE FROM items'),
      env.DB.prepare('DELETE FROM wishlists'),
      env.DB.prepare('DELETE FROM members')
    ]);
  });

  it.each(['', 'not-an-email', 'a'.repeat(255), 'person @example.com'])(
    'rejects an invalid authenticated email: %s',
    async (email) => {
      await expect(ensureMemberForEmail(env.DB, email)).rejects.toThrow('valid email address');
    }
  );

  it('creates exactly one member and one wishlist', async () => {
    const member = await ensureMemberForEmail(env.DB, 'Jamie.Example@example.com');

    expect(member).toMatchObject({
      email: 'jamie.example@example.com',
      displayName: 'jamie example'
    });
    expect(member.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(member.wishlistId).toMatch(/^[0-9a-f-]{36}$/);

    const counts = await env.DB.prepare(
      `SELECT
         (SELECT count(*) FROM members) AS member_count,
         (SELECT count(*) FROM wishlists) AS wishlist_count`
    ).first<{ member_count: number; wishlist_count: number }>();

    expect(counts).toEqual({ member_count: 1, wishlist_count: 1 });
  });

  it('returns the existing pair for repeated and case-insensitive logins', async () => {
    const first = await ensureMemberForEmail(env.DB, 'Alex@example.com');
    const second = await ensureMemberForEmail(env.DB, '  ALEX@EXAMPLE.COM  ');

    expect(second).toEqual(first);

    const counts = await env.DB.prepare(
      `SELECT
         (SELECT count(*) FROM members) AS member_count,
         (SELECT count(*) FROM wishlists) AS wishlist_count`
    ).first<{ member_count: number; wishlist_count: number }>();

    expect(counts).toEqual({ member_count: 1, wishlist_count: 1 });
  });

  it('enforces one wishlist per member at the database boundary', async () => {
    const member = await ensureMemberForEmail(env.DB, 'river@example.com');

    await expect(
      env.DB.prepare('INSERT INTO wishlists (id, owner_member_id) VALUES (?1, ?2)')
        .bind(crypto.randomUUID(), member.id)
        .run()
    ).rejects.toThrow();
  });
});
