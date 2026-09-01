import type { MemberRole } from './members';

export type JoinedFamilyMember = {
  status: 'joined';
  id: string;
  email: string;
  displayName: string;
  role: MemberRole;
  joinedAt: string;
};

export type WaitingFamilyMember = {
  status: 'waiting';
  id: string;
  email: string;
  displayName: string;
  invitedAt: string;
};

export type FamilyPerson = JoinedFamilyMember | WaitingFamilyMember;

export type FamilyInvitationInput = {
  email: FormDataEntryValue | null;
  displayName: FormDataEntryValue | null;
};

export type PreparedFamilyInvitation = {
  id: string;
  email: string;
  displayName: string;
};

type JoinedFamilyMemberRow = {
  id: string;
  email: string;
  display_name: string;
  role: MemberRole;
  created_at: string;
};

type WaitingFamilyMemberRow = {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
};

type InvitationAvailabilityRow = {
  inviter_role: MemberRole | null;
  member_exists: number;
  invitation_exists: number;
};

export class FamilyMemberInputError extends Error {}

export class FamilyAdminRequiredError extends Error {}

function normaliseInvitationEmail(value: FormDataEntryValue | null): string {
  if (typeof value !== 'string') {
    throw new FamilyMemberInputError('Enter the email address they will use to sign in.');
  }

  const email = value.trim().toLowerCase();

  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new FamilyMemberInputError('Enter a complete email address, such as name@example.com.');
  }

  return email;
}

function normaliseInvitationDisplayName(value: FormDataEntryValue | null): string {
  if (typeof value !== 'string') {
    throw new FamilyMemberInputError('Enter the name your family knows them by.');
  }

  const displayName = value.replace(/\s+/g, ' ').trim();

  if (!displayName) {
    throw new FamilyMemberInputError('Enter the name your family knows them by.');
  }

  if (displayName.length > 80) {
    throw new FamilyMemberInputError('Keep their name to 80 characters or fewer.');
  }

  return displayName;
}

export async function listFamilyPeople(db: D1Database): Promise<FamilyPerson[]> {
  const [joinedResult, waitingResult] = await Promise.all([
    db
      .prepare(
        `SELECT id, email, display_name, role, created_at
       FROM members
       ORDER BY
         CASE role WHEN 'admin' THEN 0 ELSE 1 END,
         display_name COLLATE NOCASE,
         created_at`
      )
      .all<JoinedFamilyMemberRow>(),
    db
      .prepare(
        `SELECT
         family_invitations.id,
         family_invitations.email,
         family_invitations.display_name,
         family_invitations.created_at
       FROM family_invitations
       WHERE family_invitations.status = 'active'
       AND NOT EXISTS (
         SELECT 1
         FROM members
         WHERE members.email = family_invitations.email COLLATE NOCASE
       )
       ORDER BY family_invitations.created_at, family_invitations.display_name COLLATE NOCASE`
      )
      .all<WaitingFamilyMemberRow>()
  ]);

  const joined = joinedResult.results.map((row): JoinedFamilyMember => ({
    status: 'joined',
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    joinedAt: row.created_at
  }));
  const waiting = waitingResult.results.map((row): WaitingFamilyMember => ({
    status: 'waiting',
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    invitedAt: row.created_at
  }));

  return [...joined, ...waiting];
}

export async function beginFamilyInvitation(
  db: D1Database,
  invitedByMemberId: string,
  input: FamilyInvitationInput
): Promise<PreparedFamilyInvitation> {
  const email = normaliseInvitationEmail(input.email);
  const displayName = normaliseInvitationDisplayName(input.displayName);
  const availability = await db
    .prepare(
      `SELECT
         (SELECT role FROM members WHERE id = ?1 LIMIT 1) AS inviter_role,
         EXISTS(
           SELECT 1 FROM members WHERE email = ?2 COLLATE NOCASE
         ) AS member_exists,
         EXISTS(
           SELECT 1 FROM family_invitations WHERE email = ?2 COLLATE NOCASE
         ) AS invitation_exists`
    )
    .bind(invitedByMemberId, email)
    .first<InvitationAvailabilityRow>();

  if (availability?.inviter_role !== 'admin') {
    throw new FamilyAdminRequiredError('Only the family organiser can add someone.');
  }

  if (availability.member_exists || availability.invitation_exists) {
    throw new FamilyMemberInputError('That email address is already part of this family.');
  }

  const invitation = {
    id: crypto.randomUUID(),
    email,
    displayName
  };

  try {
    const result = await db
      .prepare(
        `INSERT INTO family_invitations (
           id,
           email,
           display_name,
           status,
           invited_by_member_id
         )
         SELECT ?1, ?2, ?3, 'pending', members.id
         FROM members
         WHERE members.id = ?4
           AND members.role = 'admin'
           AND NOT EXISTS (
             SELECT 1 FROM members existing_member
             WHERE existing_member.email = ?2 COLLATE NOCASE
           )`
      )
      .bind(invitation.id, invitation.email, invitation.displayName, invitedByMemberId)
      .run();

    if (!result.success || result.meta.changes !== 1) {
      throw new FamilyAdminRequiredError('Only the family organiser can add someone.');
    }
  } catch (error) {
    if (error instanceof FamilyAdminRequiredError) throw error;

    throw new FamilyMemberInputError(
      'That email address has already been added. Refresh the page to see the latest family list.'
    );
  }

  return invitation;
}

export async function activateFamilyInvitation(
  db: D1Database,
  invitationId: string,
  accessPolicyId: string
): Promise<void> {
  const result = await db
    .prepare(
      `UPDATE family_invitations
       SET access_policy_id = ?1, status = 'active'
       WHERE id = ?2 AND status = 'pending' AND access_policy_id IS NULL`
    )
    .bind(accessPolicyId, invitationId)
    .run();

  if (!result.success || result.meta.changes !== 1) {
    throw new FamilyMemberInputError(
      'The invitation could not be completed. Nothing has been admitted, so it is safe to try again.'
    );
  }
}

export async function cancelPendingFamilyInvitation(
  db: D1Database,
  invitationId: string
): Promise<void> {
  const result = await db
    .prepare(
      `DELETE FROM family_invitations
       WHERE id = ?1 AND status = 'pending' AND access_policy_id IS NULL`
    )
    .bind(invitationId)
    .run();

  if (!result.success || result.meta.changes !== 1) {
    throw new Error('Could not cancel the pending family invitation.');
  }
}

export async function markFamilyInvitationForCleanup(
  db: D1Database,
  invitationId: string,
  accessPolicyId: string
): Promise<void> {
  const result = await db
    .prepare(
      `UPDATE family_invitations
       SET access_policy_id = ?1, status = 'cleanup_required'
       WHERE id = ?2 AND status = 'pending' AND access_policy_id IS NULL`
    )
    .bind(accessPolicyId, invitationId)
    .run();

  if (!result.success || result.meta.changes !== 1) {
    throw new Error('Could not record the Access policy requiring cleanup.');
  }
}
