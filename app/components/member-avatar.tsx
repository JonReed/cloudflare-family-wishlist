import { avatarInitials } from '../lib/avatar-initials';
import type { FamilyPerson } from '../lib/db/family-members';

export function FamilyPersonAvatar({ person }: { person: FamilyPerson }) {
  const memberId =
    person.status === 'joined' ? person.id : person.status === 'waiting' ? person.memberId : null;
  if (memberId) return <MemberAvatar member={{ id: memberId, displayName: person.displayName }} />;
  return (
    <span className="family-person-initial" aria-hidden="true">
      {avatarInitials(person.displayName)}
    </span>
  );
}

export function MemberAvatar({
  member,
  large = false
}: {
  member: { id: string; displayName: string };
  large?: boolean;
}) {
  return (
    <img
      className={large ? 'member-avatar member-avatar-large' : 'member-avatar'}
      src={`/avatar/${encodeURIComponent(member.id)}?initials=${encodeURIComponent(avatarInitials(member.displayName))}`}
      width={large ? 80 : 40}
      height={large ? 80 : 40}
      alt=""
      decoding="async"
      referrerPolicy="no-referrer"
    />
  );
}
