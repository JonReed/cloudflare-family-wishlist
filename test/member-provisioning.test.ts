import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import { ensureMemberForEmail, updateMemberDisplayName } from '../app/lib/db/members';

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

describe('updateMemberDisplayName', () => {
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare('DELETE FROM claims'),
      env.DB.prepare('DELETE FROM items'),
      env.DB.prepare('DELETE FROM wishlists'),
      env.DB.prepare('DELETE FROM members')
    ]);
  });

  it.each([null, '', '   ', 'a'.repeat(81)])(
    'rejects an invalid display name: %s',
    async (name) => {
      const member = await ensureMemberForEmail(env.DB, 'alex@example.com');

      await expect(updateMemberDisplayName(env.DB, member.id, name)).rejects.toThrow();
    }
  );

  it('trims and saves a display name at the 80-character boundary', async () => {
    const member = await ensureMemberForEmail(env.DB, 'alex@example.com');
    const boundaryName = 'a'.repeat(80);

    await expect(updateMemberDisplayName(env.DB, member.id, `  ${boundaryName}  `)).resolves.toBe(
      boundaryName
    );

    const updated = await ensureMemberForEmail(env.DB, member.email);
    expect(updated.displayName).toBe(boundaryName);
  });

  it('updates only the authenticated member represented by the supplied id', async () => {
    const alex = await ensureMemberForEmail(env.DB, 'alex@example.com');
    const sam = await ensureMemberForEmail(env.DB, 'sam@example.com');

    await updateMemberDisplayName(env.DB, alex.id, 'Alex Reed');

    await expect(ensureMemberForEmail(env.DB, alex.email)).resolves.toMatchObject({
      displayName: 'Alex Reed'
    });
    await expect(ensureMemberForEmail(env.DB, sam.email)).resolves.toMatchObject({
      displayName: 'sam'
    });
  });

  it('does not create a profile when the member id is unknown', async () => {
    await expect(
      updateMemberDisplayName(env.DB, crypto.randomUUID(), 'Unexpected member')
    ).rejects.toThrow('couldn’t find your profile');

    const count = await env.DB.prepare('SELECT count(*) AS count FROM members').first<{
      count: number;
    }>();
    expect(count?.count).toBe(0);
  });
});
