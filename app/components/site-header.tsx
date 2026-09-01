import { Brand } from './brand';

import type { MemberWithWishlist } from '../lib/db/members';

export type SiteSection = 'wishlists' | 'add-from-anywhere' | 'family' | 'profile';

type SiteHeaderProps = {
  member: Pick<MemberWithWishlist, 'displayName' | 'role'>;
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
        <span className="account-greeting" title={member.displayName}>
          Hello, <strong>{member.displayName}</strong>
        </span>
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
        <a href="/profile" aria-current={currentPage(current, 'profile')}>
          Profile
        </a>
        <a href="/cdn-cgi/access/logout">Sign out</a>
      </nav>
    </header>
  );
}
