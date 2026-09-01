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

  it('never permits removing the organiser', async () => {
    const admin = await ensureMemberForEmail(env.DB, 'admin@example.com', 'admin@example.com');

    await expect(prepareFamilyMemberRemoval(env.DB, admin.id, admin.id)).rejects.toThrow(
      'cannot be removed'
    );
  });
});
