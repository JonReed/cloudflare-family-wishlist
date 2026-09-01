import { describe, expect, it } from 'vitest';

import { createAddPageHref, createBookmarkletHref } from '../app/lib/bookmarklet';

describe('wishlist bookmarklet', () => {
  it('builds a deployment-specific add-page address for Shortcuts and clipboard links', () => {
    expect(createAddPageHref('https://wishes.teamreed.net/profile?from=nav')).toBe(
      'https://wishes.teamreed.net/add'
    );
  });

  it('opens this deployment add page with the current browser URL', () => {
    const href = createBookmarkletHref('https://wishes.teamreed.net/profile');

    expect(href).toMatch(/^javascript:/);
    expect(href).toContain('https://wishes.teamreed.net/add');
    expect(href).toContain("searchParams.set('url',location.href)");
    expect(href).toContain("window.open(destination.toString(),'_blank','noopener')");
    expect(href).not.toContain('/profile');
  });

  it.each(['ftp://example.com', 'javascript:alert(1)', 'not a URL'])(
    'rejects an unsafe deployment URL: %s',
    (origin) => {
      expect(() => createBookmarkletHref(origin)).toThrow('web address');
      expect(() => createAddPageHref(origin)).toThrow('web address');
    }
  );
});
