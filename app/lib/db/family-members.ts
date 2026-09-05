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
  memberId: string | null;
};

export type AttentionFamilyMember = {
  status: 'attention';
  id: string;
  email: string;
  displayName: string;
  invitedAt: string;
};

export type RemovingFamilyMember = {
  status: 'removing';
  id: string;
  email: string;
  displayName: string;
  joinedAt: string;
};

export type FamilyPerson =
  JoinedFamilyMember | WaitingFamilyMember | AttentionFamilyMember | RemovingFamilyMember;

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
  status: 'active' | 'pending' | 'cleanup_required';
  member_id: string | null;
};

type RemovingFamilyMemberRow = {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
};

export type FamilyInvitationForRepair = PreparedFamilyInvitation & {
  accessPolicyId: string | null;
};

export type FamilyMemberRemoval = {
  memberId: string;
  email: string;
  accessPolicyId: string;
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
  const [joinedResult, waitingResult, removingResult] = await Promise.all([
    db
      .prepare(
        `SELECT id, email, display_name, role, first_signed_in_at AS created_at
       FROM members
       WHERE disabled_at IS NULL AND first_signed_in_at IS NOT NULL
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
         family_invitations.created_at,
         family_invitations.status,
         (SELECT id FROM members WHERE members.email = family_invitations.email COLLATE NOCASE) AS member_id
       FROM family_invitations
       WHERE family_invitations.status IN ('active', 'pending', 'cleanup_required')
       AND NOT EXISTS (
         SELECT 1
         FROM members
         WHERE members.email = family_invitations.email COLLATE NOCASE
           AND (members.first_signed_in_at IS NOT NULL OR members.disabled_at IS NOT NULL)
       )
       ORDER BY family_invitations.created_at, family_invitations.display_name COLLATE NOCASE`
      )
      .all<WaitingFamilyMemberRow>(),
    db
      .prepare(
        `SELECT members.id, members.email, members.display_name, members.created_at
         FROM members
         INNER JOIN family_invitations
           ON family_invitations.email = members.email COLLATE NOCASE
         WHERE members.disabled_at IS NOT NULL
           AND family_invitations.status IN ('active', 'revocation_required')
         ORDER BY members.created_at, members.display_name COLLATE NOCASE`
      )
      .all<RemovingFamilyMemberRow>()
  ]);

  const joined = joinedResult.results.map((row): JoinedFamilyMember => ({
    status: 'joined',
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    joinedAt: row.created_at
  }));
  const waiting = waitingResult.results.map((row): WaitingFamilyMember | AttentionFamilyMember => ({
    status: row.status === 'active' ? 'waiting' : 'attention',
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    invitedAt: row.created_at,
    memberId: row.member_id
  }));
  const removing = removingResult.results.map((row): RemovingFamilyMember => ({
    status: 'removing',
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    joinedAt: row.created_at
  }));

  return [...joined, ...waiting, ...removing];
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
         (SELECT role FROM members WHERE id = ?1 AND disabled_at IS NULL LIMIT 1) AS inviter_role,
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
           AND members.disabled_at IS NULL
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
  // Activation and the member/list pair commit together: failed provisioning
  // leaves the invitation pending so the caller can safely compensate Access.
  const [result] = await db.batch([
    db
      .prepare(
        `UPDATE family_invitations
       SET access_policy_id = ?1, status = 'active'
       WHERE id = ?2 AND (
         status IN ('pending', 'cleanup_required')
         OR (status = 'active' AND access_policy_id = ?1)
       )`
      )
      .bind(accessPolicyId, invitationId),
    db
      .prepare(
        `INSERT INTO members (id, email, display_name, role)
      SELECT ?1, email, display_name, 'member' FROM family_invitations
      WHERE id = ?2 AND status = 'active' AND access_policy_id = ?3
      ON CONFLICT (email) DO NOTHING`
      )
      .bind(crypto.randomUUID(), invitationId, accessPolicyId),
    db
      .prepare(
        `INSERT INTO wishlists (id, owner_member_id)
      SELECT ?1, members.id FROM members
      INNER JOIN family_invitations ON family_invitations.email = members.email COLLATE NOCASE
      WHERE family_invitations.id = ?2 AND family_invitations.status = 'active'
        AND family_invitations.access_policy_id = ?3 AND members.disabled_at IS NULL
      ON CONFLICT (owner_member_id) DO NOTHING`
      )
      .bind(crypto.randomUUID(), invitationId, accessPolicyId)
  ]);

  if (!result?.success || result.meta.changes !== 1) {
    throw new FamilyMemberInputError(
      'The invitation could not be completed. Nothing has been admitted, so it is safe to try again.'
    );
  }
}

export async function getFamilyInvitationForRepair(
  db: D1Database,
  adminMemberId: string,
  invitationId: string
): Promise<FamilyInvitationForRepair> {
  const row = await db
    .prepare(
      `SELECT
         family_invitations.id,
         family_invitations.email,
         family_invitations.display_name,
         family_invitations.access_policy_id
       FROM family_invitations
       INNER JOIN members admin ON admin.id = ?1
       WHERE family_invitations.id = ?2
         AND family_invitations.status IN ('pending', 'cleanup_required')
         AND admin.role = 'admin'
         AND admin.disabled_at IS NULL`
    )
    .bind(adminMemberId, invitationId)
    .first<{
      id: string;
      email: string;
      display_name: string;
      access_policy_id: string | null;
    }>();

  if (!row) {
    throw new FamilyAdminRequiredError('Only the family organiser can repair an invitation.');
  }

  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    accessPolicyId: row.access_policy_id
  };
}

export async function prepareFamilyMemberRemoval(
  db: D1Database,
  adminMemberId: string,
  memberId: string
): Promise<FamilyMemberRemoval> {
  const target = await db
    .prepare(
      `SELECT
         target.id,
         target.email,
         target.role,
         target.disabled_at,
         family_invitations.access_policy_id,
         family_invitations.status AS invitation_status
       FROM members target
       INNER JOIN members admin ON admin.id = ?1
       INNER JOIN family_invitations
         ON family_invitations.email = target.email COLLATE NOCASE
       WHERE target.id = ?2
         AND admin.role = 'admin'
         AND admin.disabled_at IS NULL
         AND target.role = 'member'
         AND family_invitations.status IN ('active', 'revocation_required')`
    )
    .bind(adminMemberId, memberId)
    .first<{
      id: string;
      email: string;
      role: MemberRole;
      disabled_at: string | null;
      access_policy_id: string;
      invitation_status: 'active' | 'revocation_required';
    }>();

  if (!target?.access_policy_id) {
    throw new FamilyMemberInputError('That family member cannot be removed from here.');
  }

  if (target.disabled_at === null) {
    const result = await db
      .prepare(
        `UPDATE members
         SET disabled_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?1 AND role = 'member' AND disabled_at IS NULL`
      )
      .bind(target.id)
      .run();
    if (!result.success || result.meta.changes !== 1) {
      throw new FamilyMemberInputError(
        'Their app access has been paused, but Cloudflare cleanup still needs attention.'
      );
    }
  }

  if (target.invitation_status === 'active') {
    const result = await db
      .prepare(
        `UPDATE family_invitations
         SET status = 'revocation_required'
         WHERE email = ?1 COLLATE NOCASE AND status = 'active'`
      )
      .bind(target.email)
      .run();
    if (!result.success || result.meta.changes !== 1) {
      throw new FamilyMemberInputError(
        'Their app access has been paused, but Cloudflare cleanup still needs attention.'
      );
    }
  }

  return { memberId: target.id, email: target.email, accessPolicyId: target.access_policy_id };
}

export async function completeFamilyMemberRemoval(db: D1Database, memberId: string): Promise<void> {
  const result = await db
    .prepare(
      `UPDATE family_invitations
       SET access_policy_id = NULL, status = 'revoked'
       WHERE email = (
         SELECT email FROM members WHERE id = ?1 AND disabled_at IS NOT NULL
       ) COLLATE NOCASE
       AND status = 'revocation_required'`
    )
    .bind(memberId)
    .run();

  if (!result.success || result.meta.changes !== 1) {
    throw new FamilyMemberInputError(
      'Cloudflare access was removed, but the family list needs attention.'
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
