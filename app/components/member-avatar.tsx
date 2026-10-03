import { avatarInitials } from '../lib/avatar-initials';

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
