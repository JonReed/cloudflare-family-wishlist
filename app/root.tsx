import { isRouteErrorResponse, Link, Links, Meta, Outlet, useRouteLoaderData } from 'react-router';

import { ClientRuntime } from './components/client-runtime';
import { cloudflareContext } from './lib/context';
import { isPublicSharePath } from './lib/public-share-path';
import type { Route } from './+types/root';
import './app.css';

export const links: Route.LinksFunction = () => [
  { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }
];

export function loader({ context, request }: Route.LoaderArgs) {
  const { cspNonce } = context.get(cloudflareContext);
  return { cspNonce, isPublicShare: isPublicSharePath(new URL(request.url).pathname) };
}

export function Layout({ children }: { children: React.ReactNode }) {
  const loaderData = useRouteLoaderData<typeof loader>('root');

  return (
    <html lang="en-GB">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light" />
        <meta name="theme-color" content="#eee3cf" />
        <meta property="csp-nonce" nonce={loaderData?.cspNonce} suppressHydrationWarning />
        <Meta />
        {/* Stylesheet links are covered by `style-src 'self'`. An explicit empty value prevents
            ServerRouter's nonce fallback from conflicting with browsers that conceal link nonces
            during hydration. */}
        <Links nonce="" />
      </head>
      <body>{children}</body>
    </html>
  );
}

export default function App({ loaderData }: Route.ComponentProps) {
  return (
    <>
      <Outlet />
      <ClientRuntime cspNonce={loaderData.cspNonce} isPublicShare={loaderData.isPublicShare} />
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const isNotFound = isRouteErrorResponse(error) && error.status === 404;
  const title = isNotFound ? 'That wish wandered off' : 'Something went a bit wonky';
  const detail = isNotFound
    ? "We couldn't find that page. It may have been moved or removed."
    : 'Please try again. If it keeps happening, the family tech support person may need a biscuit.';

  return (
    <main className="error-page">
      <section className="error-sheet">
        <p className="section-kicker">{isNotFound ? '404' : 'Unexpected error'}</p>
        <h1>{title}</h1>
        <p>{detail}</p>
        <Link to="/" className="error-home-link">
          Back to the family lists
        </Link>
      </section>
    </main>
  );
}
