import { activateFamilyInvitation, beginFamilyInvitation } from '../app/lib/db/family-members';
import { ensureMemberForEmail, type MemberWithWishlist } from '../app/lib/db/members';

export async function inviteAndProvisionMember(
  db: D1Database,
  admin: MemberWithWishlist,
  email: string,
  displayName = email.split('@', 1)[0] ?? 'Family member'
): Promise<MemberWithWishlist> {
  const invitation = await beginFamilyInvitation(db, admin.id, { email, displayName });
  await activateFamilyInvitation(db, invitation.id, crypto.randomUUID());
  return ensureMemberForEmail(db, email);
}
