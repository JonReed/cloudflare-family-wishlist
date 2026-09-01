import { RouterContextProvider, createRequestHandler } from 'react-router';

import { AuthenticationError, authenticateAccessRequest } from '../app/lib/auth/access';
import { cloudflareContext, identityContext, type RuntimeEnv } from '../app/lib/context';
import { RequestSecurityError, secureMutationRequest } from '../app/lib/request-security';
import { isPublicShareRequest, redactedRequestPath } from '../app/lib/public-share-path';
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

type RouterRequestHandler = (request: Request, context: RouterContextProvider) => Promise<Response>;

function createCspNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function createAppWorker(
  routerRequestHandler: RouterRequestHandler = requestHandler
): ExportedHandler<Env> {
  return {
    async fetch(request, env, ctx): Promise<Response> {
      const context = new RouterContextProvider();
      const cspNonce = createCspNonce();

      try {
        const runtimeEnv = env as RuntimeEnv;
        const securedRequest = await secureMutationRequest(request, {
          allowDevelopmentOrigin: import.meta.env.DEV
        });
        const publicShare = isPublicShareRequest(securedRequest);

        context.set(cloudflareContext, { env: runtimeEnv, ctx, cspNonce });
        if (!publicShare) {
          const identity = await authenticateAccessRequest(securedRequest, runtimeEnv, {
            allowLocalDevelopmentIdentity: import.meta.env.DEV
          });
          context.set(identityContext, identity);
        }

        const response = await routerRequestHandler(securedRequest, context);
        return withSecurityHeaders(response, cspNonce, { publicShare });
      } catch (error) {
        if (error instanceof RequestSecurityError) {
          console.warn(
            JSON.stringify({
              event: 'request_rejected',
              code: error.code,
              status: error.status
            })
          );
          return withSecurityHeaders(
            new Response(error.message, { status: error.status }),
            cspNonce
          );
        }

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
        const publicShare = isPublicShareRequest(request);
        console.error(
          JSON.stringify({
            event: 'request_failed',
            method: request.method,
            path: redactedRequestPath(url.pathname),
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        );

        return withSecurityHeaders(
          new Response('Internal server error', { status: 500 }),
          cspNonce,
          {
            publicShare
          }
        );
      }
    }
  } satisfies ExportedHandler<Env>;
}

export default createAppWorker();
