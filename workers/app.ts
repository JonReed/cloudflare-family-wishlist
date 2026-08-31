import { RouterContextProvider, createRequestHandler } from 'react-router';

import { AuthenticationError, authenticateAccessRequest } from '../app/lib/auth/access';
import { cloudflareContext, identityContext, type RuntimeEnv } from '../app/lib/context';

const requestHandler = createRequestHandler(
  async () => {
    const build = await import('virtual:react-router/server-build');

    return {
      ...build,
      // The Cloudflare Vite proxy uses an internal request origin in local
      // development. The fixed local identity and loopback dev server make a
      // broad development exception safe; production remains same-origin only.
      allowedActionOrigins: import.meta.env.DEV ? ['**'] : []
    };
  },
  import.meta.env.MODE
);

const SECURITY_HEADERS = {
  'Cache-Control': 'private, no-store',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'none'",
    "style-src 'self'",
    "img-src 'self' https: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join('; '),
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), geolocation=(), microphone=(), payment=(), usb=()',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow, noarchive'
} as const;

function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);

  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(name, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const context = new RouterContextProvider();

    try {
      const runtimeEnv = env as RuntimeEnv;
      const identity = await authenticateAccessRequest(request, runtimeEnv, {
        allowLocalDevelopmentIdentity: import.meta.env.DEV
      });

      context.set(cloudflareContext, { env: runtimeEnv, ctx });
      context.set(identityContext, identity);

      const response = await requestHandler(request, context);
      return withSecurityHeaders(response);
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
        return withSecurityHeaders(new Response(message, { status: error.status }));
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

      return withSecurityHeaders(new Response('Internal server error', { status: 500 }));
    }
  }
} satisfies ExportedHandler<Env>;
