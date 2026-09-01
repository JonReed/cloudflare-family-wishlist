import { redirect } from 'react-router';

import { sharedProductUrl } from '../lib/share-target';

import type { Route } from './+types/share-target';

export function loader({ request }: Route.LoaderArgs) {
  const productUrl = sharedProductUrl(new URL(request.url).searchParams);
  if (!productUrl) return redirect('/add');

  const addUrl = new URL('/add', request.url);
  addUrl.searchParams.set('url', productUrl);
  return redirect(`${addUrl.pathname}${addUrl.search}`);
}
