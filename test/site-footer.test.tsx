import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { version } from '../package.json';

import { SiteFooter } from '../app/components/site-footer';

describe('site footer', () => {
  it('keeps cookie information in a native footer disclosure with an initially hidden introduction', () => {
    const html = renderToStaticMarkup(<SiteFooter />);

    expect(html).toContain('aria-label="Cookie information" data-cookie-notice="true" hidden=""');
    expect(html).toContain('<summary>Cookies &amp; privacy</summary>');
    expect(html).toContain('id="cookie-information"');
    expect(html).toContain('data-dismiss-cookie-notice="true"');
    expect(html).not.toMatch(/accept|agree|consent/i);
  });

  it('links the project name to the brochure site and keeps repository resources available', () => {
    const html = renderToStaticMarkup(<SiteFooter />);
    const repository = 'https://github.com/JonReed/cloudflare-family-wishlist';

    expect(html).toContain(
      '<a class="footer-project" href="https://familywishlist.org/" target="_blank" rel="noreferrer">Family Wishlist</a>'
    );
    expect(html).toContain(
      `<a href="${repository}" target="_blank" rel="noreferrer">Source code</a>`
    );
    expect(html).toContain(`href="${repository}/blob/main/LICENSE"`);
    expect(html).toContain(`href="${repository}/issues"`);
    expect(html).toContain(
      `<a href="${repository}#readme" target="_blank" rel="noreferrer">Set up your own</a>`
    );
    expect(html).not.toContain('<svg');
    expect(html).toContain(`v${version} · Built to run on Cloudflare`);
  });
});
