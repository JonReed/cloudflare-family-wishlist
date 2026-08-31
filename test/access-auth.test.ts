import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';

import {
  AuthenticationError,
  authenticateAccessRequest,
  verifyAccessJwt
} from '../app/lib/auth/access';

const issuer = 'https://family.cloudflareaccess.com';
const audience = 'example-application-audience';

async function signedToken(
  claims: Record<string, unknown> = {},
  overrides: { audience?: string; issuer?: string } = {}
) {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = crypto.randomUUID();

  const token = await new SignJWT({ email: 'Person@Example.com', ...claims })
    .setProtectedHeader({ alg: 'RS256', kid: publicJwk.kid })
    .setIssuer(overrides.issuer ?? issuer)
    .setAudience(overrides.audience ?? audience)
    .setSubject('access-user-id')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey);

  return { keySet: createLocalJWKSet({ keys: [publicJwk] }), token };
}

describe('verifyAccessJwt', () => {
  it('verifies the signature and returns a normalised identity', async () => {
    const { keySet, token } = await signedToken();

    await expect(verifyAccessJwt(token, { audience, issuer }, keySet)).resolves.toEqual({
      email: 'person@example.com',
      subject: 'access-user-id'
    });
  });

  it.each([
    ['wrong audience', { audience: 'different-audience' }],
    ['wrong issuer', { issuer: 'https://different.cloudflareaccess.com' }]
  ])('rejects a token with the %s', async (_label, overrides) => {
    const { keySet, token } = await signedToken({}, overrides);

    await expect(verifyAccessJwt(token, { audience, issuer }, keySet)).rejects.toMatchObject({
      code: 'access_token_invalid',
      status: 401
    });
  });

  it('rejects an expired token', async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const publicJwk = await exportJWK(publicKey);
    publicJwk.kid = crypto.randomUUID();
    const token = await new SignJWT({ email: 'person@example.com' })
      .setProtectedHeader({ alg: 'RS256', kid: publicJwk.kid })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject('access-user-id')
      .setExpirationTime('1s ago')
      .sign(privateKey);

    await expect(
      verifyAccessJwt(token, { audience, issuer }, createLocalJWKSet({ keys: [publicJwk] }))
    ).rejects.toBeInstanceOf(AuthenticationError);
  });

  it.each([{ email: '' }, { email: 'not-an-email' }, { email: null }])(
    'rejects missing or malformed identity claims',
    async (claims) => {
      const { keySet, token } = await signedToken(claims);

      await expect(verifyAccessJwt(token, { audience, issuer }, keySet)).rejects.toMatchObject({
        code: 'access_token_invalid'
      });
    }
  );

  it('rejects a token without a subject', async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const publicJwk = await exportJWK(publicKey);
    publicJwk.kid = crypto.randomUUID();
    const token = await new SignJWT({ email: 'person@example.com' })
      .setProtectedHeader({ alg: 'RS256', kid: publicJwk.kid })
      .setIssuer(issuer)
      .setAudience(audience)
      .setExpirationTime('5m')
      .sign(privateKey);

    await expect(
      verifyAccessJwt(token, { audience, issuer }, createLocalJWKSet({ keys: [publicJwk] }))
    ).rejects.toMatchObject({ code: 'access_token_invalid' });
  });
});

describe('authenticateAccessRequest', () => {
  it('fails closed when Access configuration is absent', async () => {
    await expect(
      authenticateAccessRequest(new Request('https://wishlist.example.com'), {})
    ).rejects.toMatchObject({ code: 'access_not_configured', status: 503 });
  });

  it('does not honour the development identity unless explicitly enabled', async () => {
    await expect(
      authenticateAccessRequest(
        new Request('http://localhost:5173'),
        {},
        { allowLocalDevelopmentIdentity: false }
      )
    ).rejects.toMatchObject({ code: 'access_not_configured' });
  });

  it('does not honour the development identity on a non-local hostname', async () => {
    await expect(
      authenticateAccessRequest(
        new Request('https://wishlist.example.com'),
        {},
        { allowLocalDevelopmentIdentity: true }
      )
    ).rejects.toMatchObject({ code: 'access_not_configured' });
  });

  it('allows an explicitly enabled local development identity', async () => {
    await expect(
      authenticateAccessRequest(
        new Request('http://localhost:5173'),
        {},
        { allowLocalDevelopmentIdentity: true }
      )
    ).resolves.toEqual({
      email: 'local-development@family.invalid',
      subject: 'local-development'
    });
  });
});
