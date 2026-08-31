import { RouterContextProvider, createRequestHandler } from 'react-router';

import { allowedActionOriginsForEnvironment } from '../app/lib/action-origins';
import { AuthenticationError, authenticateAccessRequest } from '../app/lib/auth/access';
import { cloudflareContext, identityContext, type RuntimeEnv } from '../app/lib/context';

function createRouterRequestHandler(allowedActionOrigins: string[]) {
  return createRequestHandler(
    async () => {
      const build = await import('virtual:react-router/server-build');

      return {
        ...build,
        allowedActionOrigins
      };
    },
    import.meta.env.MODE
  );
}

const SECURITY_HEADERS = {
  'Cache-Control': 'private, no-store',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), geolocation=(), microphone=(), payment=(), usb=()',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow, noarchive'
} as const;

function createCspNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function withSecurityHeaders(response: Response, cspNonce: string): Response {
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

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const context = new RouterContextProvider();
    const cspNonce = createCspNonce();

    try {
      const runtimeEnv = env as RuntimeEnv;
      const identity = await authenticateAccessRequest(request, runtimeEnv, {
        allowLocalDevelopmentIdentity: import.meta.env.DEV
      });

      context.set(cloudflareContext, { env: runtimeEnv, ctx, cspNonce });
      context.set(identityContext, identity);

      // Cloudflare may expose an internal request URL to the Worker while the
      // browser posts from the public custom hostname. React Router compares
      // those origins before invoking an action, so explicitly allow only this
      // deployment's configured public hostname in production.
      const allowedActionOrigins = allowedActionOriginsForEnvironment(
        runtimeEnv.PUBLIC_HOSTNAME,
        import.meta.env.DEV
      );
      const requestHandler = createRouterRequestHandler(allowedActionOrigins);
      const response = await requestHandler(request, context);
      return withSecurityHeaders(response, cspNonce);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        console.warn(
          JSON.stringify({
            event: 'authentication_failed',
            code: error.code,
            status: error.status
          })
        );

        const message =
          error.status === 503 ? 'Authentication is not configured.' : 'Authentication required.';
        return withSecurityHeaders(new Response(message, { status: error.status }), cspNonce);
      }

      const url = new URL(request.url);
      console.error(
        JSON.stringify({
          event: 'request_failed',
          method: request.method,
          path: url.pathname,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      );

      return withSecurityHeaders(new Response('Internal server error', { status: 500 }), cspNonce);
    }
  }
} satisfies ExportedHandler<Env>;
