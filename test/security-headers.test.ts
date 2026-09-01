import { describe, expect, it } from 'vitest';

import { withSecurityHeaders } from '../app/lib/security-headers';

describe('security headers', () => {
  it('preserves a concrete origin for same-origin HTML form posts', () => {
    const response = withSecurityHeaders(new Response('ok'), 'test-nonce');

    expect(response.headers.get('Referrer-Policy')).toBe('same-origin');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('Content-Security-Policy')).toContain("worker-src 'self'");
    expect(response.headers.get('Content-Security-Policy')).toContain(
      "style-src 'self' 'nonce-test-nonce'"
    );
  });

  it('allows only a marked proxied image to use the private browser cache', () => {
    const response = withSecurityHeaders(
      new Response('image', {
        headers: {
          'Cache-Control': 'public, max-age=999999',
          'X-Product-Image-Proxy': '1'
        }
      }),
      'test-nonce'
    );

    expect(response.headers.get('Cache-Control')).toBe('private, max-age=86400');
    expect(response.headers.has('X-Product-Image-Proxy')).toBe(false);
  });

  it('does not cache shared pictures or send their bearer URL as a referrer', () => {
    const response = withSecurityHeaders(
      new Response('image', { headers: { 'X-Product-Image-Proxy': '1' } }),
      'test-nonce',
      { publicShare: true }
    );

    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
  });
});
