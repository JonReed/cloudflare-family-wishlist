import { isRouteErrorResponse, Link, Links, Meta, Outlet } from 'react-router';

import type { Route } from './+types/root';
import './app.css';

export const links: Route.LinksFunction = () => [
  { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' }
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light" />
        <Meta />
        <Links />
      </head>
      <body>{children}</body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const isNotFound = isRouteErrorResponse(error) && error.status === 404;
  const title = isNotFound ? 'That wish wandered off' : 'Something went a bit wonky';
  const detail = isNotFound
    ? "We couldn't find that page. It may have been moved or removed."
    : 'Please try again. If it keeps happening, the family tech support person may need a biscuit.';

  return (
    <main className="grid min-h-screen place-items-center px-6 py-16">
      <section className="border-ink/10 bg-paper shadow-soft w-full max-w-xl rounded-[2rem] border p-8 text-center sm:p-12">
        <p className="text-leaf text-sm font-bold tracking-[0.18em] uppercase">
          {isNotFound ? '404' : 'Unexpected error'}
        </p>
        <h1 className="font-display text-ink mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          {title}
        </h1>
        <p className="text-ink-muted mx-auto mt-4 max-w-md text-base leading-7">{detail}</p>
        <Link
          to="/"
          className="bg-ink text-paper hover:bg-leaf focus-visible:outline-leaf mt-8 inline-flex min-h-11 items-center justify-center rounded-full px-6 py-3 font-bold transition focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          Back to the family lists
        </Link>
      </section>
    </main>
  );
}
