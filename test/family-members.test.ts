import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  activateFamilyInvitation,
  beginFamilyInvitation,
  cancelPendingFamilyInvitation,
  completeFamilyMemberRemoval,
  getFamilyInvitationForRepair,
  listFamilyPeople,
  markFamilyInvitationForCleanup,
  prepareFamilyMemberRemoval
} from '../app/lib/db/family-members';
import { ensureMemberForEmail } from '../app/lib/db/members';
import {
  createWishlistItem,
  claimWishlistItem,
  listFamilyWishlists
} from '../app/lib/db/wishlists';
import { inviteAndProvisionMember } from './family-fixtures';

describe('family member administration', () => {
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

  it.each([
    [{ displayName: null, email: 'person@example.com' }, 'name your family knows'],
    [{ displayName: '', email: 'person@example.com' }, 'name your family knows'],
    [{ displayName: 'x'.repeat(81), email: 'person@example.com' }, '80 characters'],
    [{ displayName: 'Person', email: null }, 'email address'],
    [{ displayName: 'Person', email: 'not-an-email' }, 'complete email address'],
    [{ displayName: 'Person', email: `${'a'.repeat(245)}@example.com` }, 'complete email address']
  ])('rejects invalid invitation input: %o', async (input, message) => {
    const admin = await ensureMemberForEmail(env.DB, 'admin@example.com', 'admin@example.com');

    await expect(beginFamilyInvitation(env.DB, admin.id, input)).rejects.toThrow(message);
  });

  it('allows only an admin to prepare an invitation', async () => {
    const admin = await ensureMemberForEmail(env.DB, 'admin@example.com', 'admin@example.com');
    const member = await inviteAndProvisionMember(env.DB, admin, 'member@example.com');

    await expect(
      beginFamilyInvitation(env.DB, member.id, {
        displayName: 'Another person',
        email: 'another@example.com'
      })
    ).rejects.toThrow('family organiser');
  });

  it('shows an invited person as waiting until their first login', async () => {
    const admin = await ensureMemberForEmail(env.DB, 'admin@example.com', 'admin@example.com');
    const invitation = await beginFamilyInvitation(env.DB, admin.id, {
      displayName: 'Jamie Reed',
      email: 'Jamie@example.com'
    });
    await activateFamilyInvitation(env.DB, invitation.id, crypto.randomUUID());

    const beforeLogin = await listFamilyWishlists(env.DB, admin.id);
    const invitedList = beforeLogin.find((list) => list.owner.displayName === 'Jamie Reed');
    expect(invitedList).toBeDefined();
    if (!invitedList) throw new Error('Invitation should create a wishlist');
    await createWishlistItem(env.DB, admin.id, invitedList.id, {
      title: 'A warm scarf',
      notes: '',
      productUrl: '',
      imageUrl: '',
      price: '',
      priority: 'high'
    });
    const item = (await listFamilyWishlists(env.DB, admin.id)).find(
      (list) => list.id === invitedList.id
    )?.items[0];
    if (!item) throw new Error('Wish should exist before login');
    await claimWishlistItem(env.DB, admin.id, item.id);

    expect(await listFamilyPeople(env.DB)).toEqual([
      expect.objectContaining({
        status: 'joined',
        email: 'admin@example.com',
        role: 'admin'
      }),
      expect.objectContaining({
        status: 'waiting',
        email: 'jamie@example.com',
        displayName: 'Jamie Reed'
      })
    ]);

    const joined = await ensureMemberForEmail(env.DB, 'JAMIE@example.com');
    expect(joined.wishlistId).toBe(invitedList.id);
    const ownList = (await listFamilyWishlists(env.DB, joined.id)).find(
      (list) => list.id === invitedList.id
    );
    expect(ownList?.items[0]).toMatchObject({ title: 'A warm scarf', claimVisibility: 'hidden' });
    expect(ownList?.items[0]).not.toHaveProperty('claim');

    expect(joined).toMatchObject({
      email: 'jamie@example.com',
      displayName: 'Jamie Reed',
      role: 'member'
    });
    expect(await listFamilyPeople(env.DB)).toEqual([
      expect.objectContaining({ status: 'joined', email: 'admin@example.com', role: 'admin' }),
      expect.objectContaining({
        status: 'joined',
        email: 'jamie@example.com',
        displayName: 'Jamie Reed',
        role: 'member'
      })
    ]);
  });

  it('reuses the pre-created wishlist during concurrent first logins', async () => {
    const admin = await ensureMemberForEmail(env.DB, 'admin@example.com', 'admin@example.com');
    const invitation = await beginFamilyInvitation(env.DB, admin.id, {
      email: 'older@example.com',
      displayName: 'Older relative'
    });
    await activateFamilyInvitation(env.DB, invitation.id, crypto.randomUUID());
    const members = await Promise.all(
      Array.from({ length: 4 }, () => ensureMemberForEmail(env.DB, invitation.email))
    );
    expect(new Set(members.map((member) => member.id)).size).toBe(1);
    expect(new Set(members.map((member) => member.wishlistId)).size).toBe(1);
    expect(await env.DB.prepare('SELECT count(*) AS total FROM wishlists').first()).toEqual({
      total: 2
    });
  });

  it('rolls back activation if wishlist creation fails', async () => {
    const admin = await ensureMemberForEmail(env.DB, 'admin@example.com', 'admin@example.com');
    const invitation = await beginFamilyInvitation(env.DB, admin.id, {
      email: 'older@example.com',
      displayName: 'Older relative'
    });
    await env.DB.prepare(
      "CREATE TRIGGER fail_wishlist BEFORE INSERT ON wishlists BEGIN SELECT RAISE(ABORT, 'test failure'); END"
    ).run();
    try {
      await expect(
        activateFamilyInvitation(env.DB, invitation.id, crypto.randomUUID())
      ).rejects.toThrow();
      expect(
        await env.DB.prepare(
          'SELECT status, access_policy_id FROM family_invitations WHERE id = ?1'
        )
          .bind(invitation.id)
          .first()
      ).toEqual({ status: 'pending', access_policy_id: null });
      expect(
        await env.DB.prepare('SELECT id FROM members WHERE email = ?1')
          .bind(invitation.email)
          .first()
      ).toBeNull();
    } finally {
      await env.DB.prepare('DROP TRIGGER fail_wishlist').run();
    }
  });

  it('can remove access before the first login without losing the wishlist', async () => {
    const admin = await ensureMemberForEmail(env.DB, 'admin@example.com', 'admin@example.com');
    const invitation = await beginFamilyInvitation(env.DB, admin.id, {
      email: 'older@example.com',
      displayName: 'Older relative'
    });
    await activateFamilyInvitation(env.DB, invitation.id, crypto.randomUUID());
    const waiting = (await listFamilyPeople(env.DB)).find((person) => person.status === 'waiting');
    if (waiting?.status !== 'waiting' || !waiting.memberId)
      throw new Error('Expected waiting member');
    await prepareFamilyMemberRemoval(env.DB, admin.id, waiting.memberId);
    await expect(ensureMemberForEmail(env.DB, invitation.email)).rejects.toThrow(
      'no longer has access'
    );
    expect(
      await env.DB.prepare('SELECT id FROM wishlists WHERE owner_member_id = ?1')
        .bind(waiting.memberId)
        .first()
    ).not.toBeNull();
  });

  it('rejects emails that already belong to a member or invitation', async () => {
    const admin = await ensureMemberForEmail(env.DB, 'admin@example.com', 'admin@example.com');
    await inviteAndProvisionMember(env.DB, admin, 'joined@example.com');

    await expect(
      beginFamilyInvitation(env.DB, admin.id, {
        displayName: 'Already joined',
        email: 'JOINED@example.com'
      })
    ).rejects.toThrow('already part');

    const invitation = await beginFamilyInvitation(env.DB, admin.id, {
      displayName: 'Waiting person',
      email: 'waiting@example.com'
    });
    await activateFamilyInvitation(env.DB, invitation.id, crypto.randomUUID());

    await expect(
      beginFamilyInvitation(env.DB, admin.id, {
        displayName: 'Same person again',
        email: 'WAITING@example.com'
      })
    ).rejects.toThrow('already part');
  });

  it('rechecks the admin role and uniqueness when beginning', async () => {
    const admin = await ensureMemberForEmail(env.DB, 'admin@example.com', 'admin@example.com');
    const member = await inviteAndProvisionMember(env.DB, admin, 'member@example.com');

    await expect(
      beginFamilyInvitation(env.DB, member.id, {
        displayName: 'Future member',
        email: 'future@example.com'
      })
    ).rejects.toThrow('family organiser');

    await beginFamilyInvitation(env.DB, admin.id, {
      displayName: 'Future member',
      email: 'future@example.com'
    });
    await expect(
      beginFamilyInvitation(env.DB, admin.id, {
        displayName: 'Future member',
        email: 'future@example.com'
      })
    ).rejects.toThrow('already part');
  });

  it('does not admit a pending or cleanup-required invitation', async () => {
    const admin = await ensureMemberForEmail(env.DB, 'admin@example.com', 'admin@example.com');
    const pending = await beginFamilyInvitation(env.DB, admin.id, {
      displayName: 'Pending person',
      email: 'pending@example.com'
    });

    await expect(ensureMemberForEmail(env.DB, pending.email)).rejects.toThrow(
      'completed family invitation'
    );

    await markFamilyInvitationForCleanup(env.DB, pending.id, crypto.randomUUID());
    await expect(ensureMemberForEmail(env.DB, pending.email)).rejects.toThrow(
      'completed family invitation'
    );
    expect(await listFamilyPeople(env.DB)).toEqual([
      expect.objectContaining({ status: 'joined', id: admin.id }),
      expect.objectContaining({ status: 'attention', id: pending.id })
    ]);
  });

  it('can cancel a pending invitation without admitting it', async () => {
    const admin = await ensureMemberForEmail(env.DB, 'admin@example.com', 'admin@example.com');
    const pending = await beginFamilyInvitation(env.DB, admin.id, {
      displayName: 'Retry person',
      email: 'retry@example.com'
    });

    await cancelPendingFamilyInvitation(env.DB, pending.id);
    await expect(
      beginFamilyInvitation(env.DB, admin.id, {
        displayName: 'Retry person',
        email: 'retry@example.com'
      })
    ).resolves.toMatchObject({ email: 'retry@example.com' });
  });

  it('exposes interrupted invitations for organiser reconciliation', async () => {
    const admin = await ensureMemberForEmail(env.DB, 'admin@example.com', 'admin@example.com');
    const pending = await beginFamilyInvitation(env.DB, admin.id, {
      displayName: 'Retry person',
      email: 'retry@example.com'
    });

    await expect(listFamilyPeople(env.DB)).resolves.toContainEqual(
      expect.objectContaining({ status: 'attention', id: pending.id })
    );
    await expect(getFamilyInvitationForRepair(env.DB, admin.id, pending.id)).resolves.toMatchObject(
      {
        email: 'retry@example.com',
        accessPolicyId: null
      }
    );
    await activateFamilyInvitation(env.DB, pending.id, crypto.randomUUID());
    await expect(listFamilyPeople(env.DB)).resolves.toContainEqual(
      expect.objectContaining({ status: 'waiting', id: pending.id })
    );
  });

  it('disables a member before Access cleanup and preserves their wishlist', async () => {
    const admin = await ensureMemberForEmail(env.DB, 'admin@example.com', 'admin@example.com');
    const member = await inviteAndProvisionMember(env.DB, admin, 'member@example.com');
    const removal = await prepareFamilyMemberRemoval(env.DB, admin.id, member.id);

    await expect(ensureMemberForEmail(env.DB, member.email)).rejects.toThrow(
      'no longer has access'
    );
    await expect(listFamilyPeople(env.DB)).resolves.toContainEqual(
      expect.objectContaining({ status: 'removing', id: member.id })
    );
    await expect(
      env.DB.prepare('SELECT id FROM wishlists WHERE owner_member_id = ?1').bind(member.id).first()
    ).resolves.not.toBeNull();

    await expect(prepareFamilyMemberRemoval(env.DB, admin.id, member.id)).resolves.toEqual(removal);

    await completeFamilyMemberRemoval(env.DB, removal.memberId);
    await expect(listFamilyPeople(env.DB)).resolves.not.toContainEqual(
      expect.objectContaining({ id: member.id })
    );
  });

  it('backfills completed legacy invitations without changing existing member or wishlist IDs', async () => {
    const admin = await ensureMemberForEmail(env.DB, 'admin@example.com', 'admin@example.com');
    const active = await beginFamilyInvitation(env.DB, admin.id, {
      email: 'waiting@example.com',
      displayName: 'Waiting relative'
    });
    const pending = await beginFamilyInvitation(env.DB, admin.id, {
      email: 'pending@example.com',
      displayName: 'Pending relative'
    });
    const cleanup = await beginFamilyInvitation(env.DB, admin.id, {
      email: 'cleanup@example.com',
      displayName: 'Cleanup relative'
    });
    await markFamilyInvitationForCleanup(env.DB, cleanup.id, crypto.randomUUID());
    await env.DB.prepare(
      "UPDATE family_invitations SET status = 'active', access_policy_id = ?1 WHERE id = ?2"
    )
      .bind(crypto.randomUUID(), active.id)
      .run();
    // Reconstruct the old test schema, then exercise the actual upgrade SQL.
    await env.DB.prepare('ALTER TABLE members DROP COLUMN first_signed_in_at').run();
    const migration = env.TEST_MIGRATIONS.find((entry) => entry.name.startsWith('0012'));
    if (!migration) throw new Error('Missing invitation migration');
    await env.DB.batch(migration.queries.map((query) => env.DB.prepare(query)));
    expect(await ensureMemberForEmail(env.DB, admin.email)).toEqual(admin);
    expect(
      (await listFamilyPeople(env.DB)).find((person) => person.email === active.email)?.status
    ).toBe('waiting');
    const lists = await listFamilyWishlists(env.DB, admin.id);
    expect(lists).toHaveLength(2);
    const newList = lists.find((list) => !list.isOwn);
    expect(newList?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
    );
    await expect(ensureMemberForEmail(env.DB, pending.email)).rejects.toThrow(
      'completed family invitation'
    );
    await expect(ensureMemberForEmail(env.DB, cleanup.email)).rejects.toThrow(
      'completed family invitation'
    );
    expect((await ensureMemberForEmail(env.DB, active.email)).wishlistId).toBe(newList?.id);
  });

  it('safely repeats activation with the same policy without replacing the wishlist', async () => {
    const admin = await ensureMemberForEmail(env.DB, 'admin@example.com', 'admin@example.com');
    const invitation = await beginFamilyInvitation(env.DB, admin.id, {
      email: 'repeat@example.com',
      displayName: 'Repeat relative'
    });
    const policyId = crypto.randomUUID();
    await activateFamilyInvitation(env.DB, invitation.id, policyId);
    const before = await listFamilyWishlists(env.DB, admin.id);
    await activateFamilyInvitation(env.DB, invitation.id, policyId);
    expect(await listFamilyWishlists(env.DB, admin.id)).toEqual(before);
    await expect(
      activateFamilyInvitation(env.DB, invitation.id, crypto.randomUUID())
    ).rejects.toThrow('could not be completed');
    expect(await listFamilyWishlists(env.DB, admin.id)).toEqual(before);
  });

  it('never permits removing the organiser', async () => {
    const admin = await ensureMemberForEmail(env.DB, 'admin@example.com', 'admin@example.com');

    await expect(prepareFamilyMemberRemoval(env.DB, admin.id, admin.id)).rejects.toThrow(
      'cannot be removed'
    );
  });
});
