import { describe, expect, it } from 'vitest';

import { withSecurityHeaders } from '../app/lib/security-headers';

describe('security headers', () => {
  it('preserves a concrete origin for same-origin HTML form posts', () => {
    const response = withSecurityHeaders(new Response('ok'), 'test-nonce');

    expect(response.headers.get('Referrer-Policy')).toBe('same-origin');
  });
});
