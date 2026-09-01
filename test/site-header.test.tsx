import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SiteHeader } from '../app/components/site-header';

describe('SiteHeader', () => {
  it('keeps the full admin navigation and greeting while marking the current page', () => {
    const html = renderToStaticMarkup(
      <SiteHeader member={{ displayName: 'Jon Reed', role: 'admin' }} current="family" />
    );

    expect(html).toContain('Hello, <strong>Jon Reed</strong>');
    expect(html).toContain('href="/">Wishlists</a>');
    expect(html).toContain('href="/bookmarklet">Add from anywhere</a>');
    expect(html).toContain('href="/family" aria-current="page">Your family</a>');
    expect(html).toContain('href="/profile">Profile</a>');
    expect(html).toContain('href="/cdn-cgi/access/logout">Sign out</a>');
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });

  it('keeps the member navigation stable without exposing the admin page', () => {
    const html = renderToStaticMarkup(
      <SiteHeader
        member={{ displayName: 'A very loved family member', role: 'member' }}
        current="profile"
      />
    );

    expect(html).toContain('Hello, <strong>A very loved family member</strong>');
    expect(html).not.toContain('href="/family"');
    expect(html).toContain('href="/profile" aria-current="page">Profile</a>');
    expect(html).toContain('href="/cdn-cgi/access/logout">Sign out</a>');
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });
});
