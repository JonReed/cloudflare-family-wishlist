import { createRemoteJWKSet, errors as joseErrors, jwtVerify, type JWTVerifyGetKey } from 'jose';

export type AuthenticatedIdentity = {
  email: string;
  subject: string;
};

export type AccessEnv = {
  ACCESS_AUD?: string;
  ACCESS_TEAM_DOMAIN?: string;
};

type AccessConfiguration = {
  audience: string;
  issuer: string;
};

type AuthenticationOptions = {
  allowLocalDevelopmentIdentity?: boolean;
};

export class AuthenticationError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 503,
    readonly code: 'access_not_configured' | 'access_token_invalid' | 'access_token_missing'
  ) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

const remoteKeySets = new Map<string, JWTVerifyGetKey>();
const LOCAL_DEVELOPMENT_IDENTITY: AuthenticatedIdentity = {
  email: 'local-development@family.invalid',
  subject: 'local-development'
};

function normaliseIdentityEmail(value: unknown): string {
  if (typeof value !== 'string') {
    throw new AuthenticationError(
      'Access token email claim is missing.',
      401,
      'access_token_invalid'
    );
  }

  const email = value.trim().toLowerCase();

  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AuthenticationError(
      'Access token email claim is invalid.',
      401,
      'access_token_invalid'
    );
  }

  return email;
}

function readAccessConfiguration(env: AccessEnv): AccessConfiguration {
  const teamDomain = env.ACCESS_TEAM_DOMAIN?.trim().toLowerCase();
  const audience = env.ACCESS_AUD?.trim();

  if (!teamDomain || !audience || !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(teamDomain)) {
    throw new AuthenticationError(
      'Cloudflare Access is not configured.',
      503,
      'access_not_configured'
    );
  }

  return {
    audience,
    issuer: `https://${teamDomain}`
  };
}

function remoteKeySetFor(issuer: string): JWTVerifyGetKey {
  const existing = remoteKeySets.get(issuer);

  if (existing) {
    return existing;
  }

  const keySet = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
  remoteKeySets.set(issuer, keySet);
  return keySet;
}

export async function verifyAccessJwt(
  token: string,
  configuration: AccessConfiguration,
  keySet: JWTVerifyGetKey = remoteKeySetFor(configuration.issuer)
): Promise<AuthenticatedIdentity> {
  try {
    const { payload } = await jwtVerify(token, keySet, {
      algorithms: ['RS256'],
      audience: configuration.audience,
      issuer: configuration.issuer
    });

    if (!payload.sub) {
      throw new AuthenticationError(
        'Access token subject claim is missing.',
        401,
        'access_token_invalid'
      );
    }

    return {
      email: normaliseIdentityEmail(payload.email),
      subject: payload.sub
    };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    if (error instanceof joseErrors.JOSEError) {
      throw new AuthenticationError(
        'Access token verification failed.',
        401,
        'access_token_invalid'
      );
    }

    throw error;
  }
}

function isLocalRequest(request: Request): boolean {
  const hostname = new URL(request.url).hostname;
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '[::1]';
}

export async function authenticateAccessRequest(
  request: Request,
  env: AccessEnv,
  options: AuthenticationOptions = {}
): Promise<AuthenticatedIdentity> {
  if (options.allowLocalDevelopmentIdentity && isLocalRequest(request)) {
    return LOCAL_DEVELOPMENT_IDENTITY;
  }

  const configuration = readAccessConfiguration(env);
  const token = request.headers.get('Cf-Access-Jwt-Assertion');

  if (!token) {
    throw new AuthenticationError(
      'Cloudflare Access assertion is missing.',
      401,
      'access_token_missing'
    );
  }

  return verifyAccessJwt(token, configuration);
}
