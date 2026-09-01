import { Outlet } from 'react-router';

import type { Route } from './+types/app-layout';

export const links: Route.LinksFunction = () => [
  { rel: 'manifest', href: '/app.webmanifest', crossOrigin: 'use-credentials' },
  { rel: 'apple-touch-icon', href: '/icons/app-192.png' }
];

export default function AppLayout() {
  return <Outlet />;
}
