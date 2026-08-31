const SECURITY_HEADERS = {
  'Cache-Control': 'private, no-store',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), geolocation=(), microphone=(), payment=(), usb=()',
  // `no-referrer` makes browsers send `Origin: null` for ordinary HTML form
  // posts. `same-origin` preserves a verifiable origin for our forms without
  // disclosing referrers to external sites.
  'Referrer-Policy': 'same-origin',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow, noarchive'
} as const;

export function withSecurityHeaders(response: Response, cspNonce: string): Response {
  const headers = new Headers(response.headers);

  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }

  headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      `script-src 'nonce-${cspNonce}'`,
      "style-src 'self'",
      "img-src 'self' https: data:",
      "font-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'"
    ].join('; ')
  );

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
