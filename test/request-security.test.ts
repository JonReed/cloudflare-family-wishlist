import { describe, expect, it } from 'vitest';

import { secureMutationRequest, type RequestSecurityError } from '../app/lib/request-security';

function formRequest(
  origin: string | null,
  body: BodyInit = new URLSearchParams({ intent: 'save' }),
  headers: HeadersInit = {}
): Request {
  const requestHeaders = new Headers(headers);
  if (origin !== null) requestHeaders.set('Origin', origin);
  if (!requestHeaders.has('Content-Type')) {
    requestHeaders.set('Content-Type', 'application/x-www-form-urlencoded;charset=UTF-8');
  }

  return new Request('https://wishlist.example/family', {
    method: 'POST',
    headers: requestHeaders,
    body
  });
}

describe('secureMutationRequest', () => {
  it('preserves a bounded same-origin form body', async () => {
    const secured = await secureMutationRequest(formRequest('https://wishlist.example'));

    expect((await secured.formData()).get('intent')).toBe('save');
  });

  it.each([null, 'null', 'not a URL'] as const)(
    'rejects an unverifiable origin: %s',
    async (origin) => {
      await expect(secureMutationRequest(formRequest(origin))).rejects.toMatchObject({
        status: 403,
        code: 'invalid_origin'
      } satisfies Partial<RequestSecurityError>);
    }
  );

  it('rejects a cross-origin form post', async () => {
    await expect(
      secureMutationRequest(formRequest('https://attacker.example'))
    ).rejects.toMatchObject({ status: 403, code: 'cross_origin' });
  });

  it('permits the Vite proxy origin only in development mode', async () => {
    const loopbackRequest = new Request('http://127.0.0.1:8788/family', {
      method: 'POST',
      headers: {
        Origin: 'http://localhost:5173',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ intent: 'save' })
    });

    await expect(
      secureMutationRequest(loopbackRequest, {
        allowDevelopmentOrigin: true
      })
    ).resolves.toBeInstanceOf(Request);
  });

  it('does not turn development mode into a wildcard origin', async () => {
    await expect(
      secureMutationRequest(formRequest('https://attacker.example'), {
        allowDevelopmentOrigin: true
      })
    ).rejects.toMatchObject({ status: 403, code: 'cross_origin' });
  });

  it('rejects unsupported mutation content types', async () => {
    await expect(
      secureMutationRequest(
        formRequest('https://wishlist.example', '{}', { 'Content-Type': 'application/json' })
      )
    ).rejects.toMatchObject({ status: 415, code: 'unsupported_content_type' });
  });

  it('rejects a streamed form body above the application limit', async () => {
    const oversized = new Uint8Array(32 * 1024 + 1);

    await expect(
      secureMutationRequest(formRequest('https://wishlist.example', oversized))
    ).rejects.toMatchObject({ status: 413, code: 'body_too_large' });
  });

  it('does not apply mutation rules to safe requests', async () => {
    const request = new Request('https://wishlist.example/');
    await expect(secureMutationRequest(request)).resolves.toBe(request);
  });
});
