import { Brand } from './brand';
import { MemberAvatar } from './member-avatar';

import type { MemberWithWishlist } from '../lib/db/members';

export type SiteSection = 'wishlists' | 'add-from-anywhere' | 'family' | 'profile';

type SiteHeaderProps = {
  member: Pick<MemberWithWishlist, 'id' | 'displayName' | 'role'>;
  current: SiteSection;
};

function currentPage(current: SiteSection, section: SiteSection) {
  return current === section ? ('page' as const) : undefined;
}

export function SiteHeader({ member, current }: SiteHeaderProps) {
  return (
    <header className="site-header page-wrap">
      <a href="/" className="brand-link" aria-label="Family Wishlist home">
        <Brand />
      </a>

      <nav className="account-links" aria-label="Your Family Wishlist">
        <a href="/" aria-current={currentPage(current, 'wishlists')}>
          Wishlists
        </a>
        <a href="/bookmarklet" aria-current={currentPage(current, 'add-from-anywhere')}>
          Add from anywhere
        </a>
        {member.role === 'admin' ? (
          <a href="/family" aria-current={currentPage(current, 'family')}>
            Your family
          </a>
        ) : null}
      </nav>

      <a
        href="/profile"
        className="account-profile"
        aria-current={currentPage(current, 'profile')}
        title={`Your profile · ${member.displayName}`}
      >
        <span className="account-profile-text">
          <strong>{member.displayName}</strong>
          <span>Profile</span>
        </span>
        <MemberAvatar member={member} />
      </a>
    </header>
  );
}
