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

  it('keeps shared responses private and permits same-origin forms without external referrers', () => {
    const response = withSecurityHeaders(
      new Response('image', { headers: { 'X-Product-Image-Proxy': '1' } }),
      'test-nonce',
      { publicShare: true }
    );

    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('Referrer-Policy')).toBe('same-origin');
  });

  it('gives avatars a short private cache without widening the image policy', () => {
    const response = withSecurityHeaders(
      new Response('image', { headers: { 'X-Member-Avatar': '1' } }),
      'test-nonce'
    );
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=300');
    expect(response.headers.has('X-Member-Avatar')).toBe(false);
    expect(response.headers.get('Content-Security-Policy')).toContain("img-src 'self' data:");
  });

  it('requires revalidation for marked shared pictures while keeping public pages uncached', () => {
    for (const status of [200, 304]) {
      const response = withSecurityHeaders(
        new Response(null, {
          status,
          headers: { 'X-Shared-Image-Proxy': '1', ETag: 'W/"picture"' }
        }),
        'test-nonce',
        { publicShare: true }
      );
      expect(response.headers.get('Cache-Control')).toBe('private, no-cache');
      expect(response.headers.get('ETag')).toBe('W/"picture"');
      expect(response.headers.has('X-Shared-Image-Proxy')).toBe(false);
      expect(response.headers.get('Content-Security-Policy')).toContain("img-src 'self' data:");
    }
    expect(
      withSecurityHeaders(new Response('page'), 'test-nonce', { publicShare: true }).headers.get(
        'Cache-Control'
      )
    ).toBe('private, no-store');
  });
});
