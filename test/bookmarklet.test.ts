import { describe, expect, it } from 'vitest';

import { createBookmarkletHref } from '../app/lib/bookmarklet';

describe('wishlist bookmarklet', () => {
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
    }
  );
});
