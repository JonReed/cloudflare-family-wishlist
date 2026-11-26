import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import CookiesPage from '../app/routes/cookies';
import { version } from '../package.json';

import { SiteFooter } from '../app/components/site-footer';

describe('site footer', () => {
  it('links to the standalone privacy page from the project footer and one-time banner', () => {
    const html = renderToStaticMarkup(<SiteFooter />);
    const [projectFooter, cookieFooter] = html.split('</footer>');

    expect(projectFooter).toMatch(/<a href="\/shared\/cookies"[^>]*>Cookies &amp; privacy<\/a>/);
    expect(cookieFooter).toMatch(
      /<a href="\/shared\/cookies"[^>]*>Read about cookies and privacy<\/a>/
    );
    expect(html).not.toContain('<details');
    expect(projectFooter).not.toContain('data-cookie-notice');
    expect(cookieFooter).toContain(
      '<footer class="cookie-notice" aria-label="Cookie information" data-cookie-notice="true" hidden=""'
    );
    expect(cookieFooter).toContain('data-dismiss-cookie-notice="true"');
    expect(html).not.toMatch(/accept|agree|consent/i);
  });

  it('renders the full privacy information without credentials or script-dependent controls', () => {
    const html = renderToStaticMarkup(<CookiesPage />);
    expect(html).toContain('<h1>Cookies &amp; privacy</h1>');
    expect(html).toContain('CF_Authorization');
    expect(html).toContain('wishlist-cookie-notice-seen');
    expect(html).toContain('<h2>Guest reservations</h2>');
    expect(html).not.toContain('data-cookie-notice');
    expect(html).not.toContain('<details');
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
