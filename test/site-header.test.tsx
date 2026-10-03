import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SiteHeader } from '../app/components/site-header';
import { MemberAvatar } from '../app/components/member-avatar';

describe('SiteHeader', () => {
  it('keeps the large profile preview styled and its image address private', () => {
    const html = renderToStaticMarkup(
      <MemberAvatar member={{ id: 'member-1', displayName: 'Jamie Reed' }} large />
    );
    expect(html).toContain('class="member-avatar member-avatar-large"');
    expect(html).toContain('src="/avatar/member-1?initials=JR"');
    expect(html).toContain('alt=""');
    expect(html).not.toContain('gravatar.com');
  });
  it('changes the image address when a saved name changes its initials', () => {
    const before = renderToStaticMarkup(
      <MemberAvatar member={{ id: 'member-1', displayName: 'Jamie Reed' }} />
    );
    const after = renderToStaticMarkup(
      <MemberAvatar member={{ id: 'member-1', displayName: 'Élodie Smith' }} />
    );
    expect(before).toContain('src="/avatar/member-1?initials=JR"');
    expect(after).toContain('src="/avatar/member-1?initials=%C3%89S"');
    expect(after).not.toContain('Élodie Smith');
  });
  it('keeps admin navigation before the member profile and marks the current page', () => {
    const html = renderToStaticMarkup(
      <SiteHeader
        member={{ id: 'member-1', displayName: 'Jon Reed', role: 'admin' }}
        current="family"
      />
    );

    expect(html).toContain('<strong>Jon Reed</strong>');
    expect(html).toContain('href="/">Wishlists</a>');
    expect(html).toContain('href="/bookmarklet">Add from anywhere</a>');
    expect(html).toContain('href="/family" aria-current="page">Your family</a>');
    expect(html).toContain('href="/profile" class="account-profile"');
    expect(html).toContain('src="/avatar/member-1?initials=JR"');
    expect(html.indexOf('href="/profile"')).toBeGreaterThan(html.indexOf('</nav>'));
    expect(html).not.toContain('/cdn-cgi/access/logout');
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it('keeps the member navigation stable without exposing the admin page', () => {
    const html = renderToStaticMarkup(
      <SiteHeader
        member={{ id: 'member-2', displayName: 'A very loved family member', role: 'member' }}
        current="profile"
      />
    );

    expect(html).toContain('<strong>A very loved family member</strong>');
    expect(html).not.toContain('href="/family"');
    expect(html).toContain('class="account-profile" aria-current="page"');
    expect(html).not.toContain('/cdn-cgi/access/logout');
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });
});
