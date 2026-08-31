import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  listFamilyPeople,
  prepareFamilyInvitation,
  saveFamilyInvitation
} from '../app/lib/db/family-members';
import { ensureMemberForEmail } from '../app/lib/db/members';

describe('family member administration', () => {
  beforeEach(async () => {
    await env.DB.batch([
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
    const admin = await ensureMemberForEmail(env.DB, 'admin@example.com');

    await expect(prepareFamilyInvitation(env.DB, admin.id, input)).rejects.toThrow(message);
  });

  it('allows only an admin to prepare an invitation', async () => {
    await ensureMemberForEmail(env.DB, 'admin@example.com');
    const member = await ensureMemberForEmail(env.DB, 'member@example.com');

    await expect(
      prepareFamilyInvitation(env.DB, member.id, {
        displayName: 'Another person',
        email: 'another@example.com'
      })
    ).rejects.toThrow('family organiser');
  });

  it('shows an invited person as waiting until their first login', async () => {
    const admin = await ensureMemberForEmail(env.DB, 'admin@example.com');
    const invitation = await prepareFamilyInvitation(env.DB, admin.id, {
      displayName: 'Jamie Reed',
      email: 'Jamie@example.com'
    });
    await saveFamilyInvitation(env.DB, admin.id, invitation, crypto.randomUUID());

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
    const admin = await ensureMemberForEmail(env.DB, 'admin@example.com');
    await ensureMemberForEmail(env.DB, 'joined@example.com');

    await expect(
      prepareFamilyInvitation(env.DB, admin.id, {
        displayName: 'Already joined',
        email: 'JOINED@example.com'
      })
    ).rejects.toThrow('already part');

    const invitation = await prepareFamilyInvitation(env.DB, admin.id, {
      displayName: 'Waiting person',
      email: 'waiting@example.com'
    });
    await saveFamilyInvitation(env.DB, admin.id, invitation, crypto.randomUUID());

    await expect(
      prepareFamilyInvitation(env.DB, admin.id, {
        displayName: 'Same person again',
        email: 'WAITING@example.com'
      })
    ).rejects.toThrow('already part');
  });

  it('rechecks the admin role and uniqueness when saving', async () => {
    const admin = await ensureMemberForEmail(env.DB, 'admin@example.com');
    const member = await ensureMemberForEmail(env.DB, 'member@example.com');
    const invitation = await prepareFamilyInvitation(env.DB, admin.id, {
      displayName: 'Future member',
      email: 'future@example.com'
    });

    await expect(
      saveFamilyInvitation(env.DB, member.id, invitation, crypto.randomUUID())
    ).rejects.toThrow('family organiser');

    await saveFamilyInvitation(env.DB, admin.id, invitation, crypto.randomUUID());
    await expect(
      saveFamilyInvitation(env.DB, admin.id, invitation, crypto.randomUUID())
    ).rejects.toThrow('already been added');
  });
});
