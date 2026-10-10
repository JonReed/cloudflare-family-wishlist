import { describe, expect, it } from 'vitest';
import { withSecurityHeaders } from '../app/lib/security-headers';

describe('security headers', () => {
  it('permits HTTPS pictures while keeping scripts, connections and documents private', () => {
    const response = withSecurityHeaders(new Response('ok'), 'test-nonce');
    const csp = response.headers.get('Content-Security-Policy');
    expect(response.headers.get('Referrer-Policy')).toBe('same-origin');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(csp).toContain("img-src 'self' https: data:");
    expect(csp).toContain("script-src 'nonce-test-nonce'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("worker-src 'self'");
    expect(csp).toContain("style-src 'self' 'nonce-test-nonce'");
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');
  });

  it('keeps shared pages private and allows same-origin forms without external referrers', () => {
    const response = withSecurityHeaders(
      new Response('page', { headers: { 'Cache-Control': 'public, max-age=999999' } }),
      'test-nonce',
      { publicShare: true }
    );
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('Referrer-Policy')).toBe('same-origin');
  });

  it('gives only signed-in avatars a short private cache', () => {
    const source = new Response('image', { headers: { 'X-Member-Avatar': '1' } });
    const response = withSecurityHeaders(source, 'test-nonce');
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=300');
    expect(response.headers.has('X-Member-Avatar')).toBe(false);
    expect(
      withSecurityHeaders(source, 'test-nonce', { publicShare: true }).headers.get('Cache-Control')
    ).toBe('private, no-store');
  });
});
