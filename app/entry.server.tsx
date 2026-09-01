import { isbot } from 'isbot';
import { renderToReadableStream } from 'react-dom/server';
import { ServerRouter, type EntryContext, type RouterContextProvider } from 'react-router';

import { cloudflareContext } from './lib/context';

export const streamTimeout = 5_000;

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  loadContext: RouterContextProvider
) {
  if (request.method.toUpperCase() === 'HEAD') {
    return new Response(null, {
      status: responseStatusCode,
      headers: responseHeaders
    });
  }

  const { cspNonce } = loadContext.get(cloudflareContext);
  let shellRendered = false;
  const userAgent = request.headers.get('user-agent');
  const body = await renderToReadableStream(
    <ServerRouter context={routerContext} url={request.url} nonce={cspNonce} />,
    {
      nonce: cspNonce,
      signal: AbortSignal.timeout(streamTimeout + 1_000),
      onError(error: unknown) {
        responseStatusCode = 500;
        if (shellRendered) console.error(error);
      }
    }
  );
  shellRendered = true;

  if ((userAgent && isbot(userAgent)) || routerContext.isSpaMode) {
    await body.allReady;
  }

  responseHeaders.set('Content-Type', 'text/html');
  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode
  });
}
