import { RouterContextProvider, createRequestHandler } from 'react-router';

import { AuthenticationError, authenticateAccessRequest } from '../app/lib/auth/access';
import { cloudflareContext, identityContext, type RuntimeEnv } from '../app/lib/context';
import { withSecurityHeaders } from '../app/lib/security-headers';

const requestHandler = createRequestHandler(
  async () => {
    const build = await import('virtual:react-router/server-build');

    return {
      ...build,
      // The Cloudflare Vite proxy uses an internal request origin in local
      // development. Production form posts remain strictly same-origin.
      allowedActionOrigins: import.meta.env.DEV ? ['**'] : []
    };
  },
  import.meta.env.MODE
);

function createCspNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
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
