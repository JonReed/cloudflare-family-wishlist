import { Brand } from '../components/brand';
import { SiteFooter } from '../components/site-footer';
import { cloudflareContext } from '../lib/context';
import {
  getSharedWishlist,
  SharedWishlistInputError,
  type SharedWishlistItem
} from '../lib/db/shared-wishlists';

import type { Route } from './+types/shared-wishlist';

export function meta() {
  return [
    { title: 'Shared wishlist' },
    { name: 'description', content: 'Gift ideas shared with family and friends.' }
  ];
}

function notFound(): never {
  // React Router uses thrown `data()` values to reach the nearest 404 error boundary.
  // eslint-disable-next-line @typescript-eslint/only-throw-error
  throw data('Not found', { status: 404 });
}

export async function loader({ context, params }: Route.LoaderArgs) {
  try {
    const { env } = context.get(cloudflareContext);
    const wishlist = await getSharedWishlist(env.DB, params.token);
    if (!wishlist) notFound();
    return { wishlist, token: params.token };
  } catch (error) {
    if (error instanceof SharedWishlistInputError) {
      notFound();
    }
    throw error;
  }
}

function formatPrice(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amountMinor / 100);
}

const priorityLabels = { low: 'Nice to have', high: 'Top wish' } as const;

function sharedImagePath(token: string, itemId: string): string {
  return `/shared/${encodeURIComponent(token)}/image/${encodeURIComponent(itemId)}`;
}

function SharedWish({ item, token }: { item: SharedWishlistItem; token: string }) {
  return (
    <li className={`wish-row shared-wish-row wish-row-${item.priority}`}>
      <div className={item.hasImage ? 'wish-content wish-content-with-image' : 'wish-content'}>
        {item.hasImage ? (
          <img
            src={sharedImagePath(token, item.id)}
            alt=""
            width="160"
            height="160"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="wish-image"
          />
        ) : null}
        <div className="wish-copy">
          <div className="wish-heading">
            <h3>{item.title}</h3>
            {item.priority === 'normal' ? null : (
              <span className={`priority priority-${item.priority}`}>
                {priorityLabels[item.priority]}
              </span>
            )}
          </div>
          {item.notes ? <p className="wish-notes">{item.notes}</p> : null}
          <div className="wish-meta">
            {item.priceAmountMinor !== null && item.priceCurrency ? (
              <span>About {formatPrice(item.priceAmountMinor, item.priceCurrency)}</span>
            ) : null}
            {item.productUrl ? (
              <a href={item.productUrl} target="_blank" rel="noreferrer">
                See where to find it <span aria-hidden="true">↗</span>
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}

export default function SharedWishlistPage({ loaderData }: Route.ComponentProps) {
  const { wishlist, token } = loaderData;
  return (
    <div className="site-shell public-share-shell">
      <header className="public-share-header page-wrap">
        <span className="brand-link">
          <Brand />
        </span>
      </header>
      <main className="public-share-main page-wrap">
        <article className="wishlist-sheet public-share-sheet">
          <span aria-hidden="true" className="paper-tape paper-tape-left" />
          <span aria-hidden="true" className="paper-tape paper-tape-right" />
          <header className="wishlist-heading">
            <div>
              <p className="section-kicker">Gift ideas</p>
              <h1>{wishlist.ownerDisplayName}’s wishlist</h1>
            </div>
            <p className="wish-count">
              {wishlist.items.length} {wishlist.items.length === 1 ? 'wish' : 'wishes'}
            </p>
          </header>
          {wishlist.items.length ? (
            <ul className="wish-list">
              {wishlist.items.map((item) => (
                <SharedWish key={item.id} item={item} token={token} />
              ))}
            </ul>
          ) : (
            <p className="empty-list">Nothing added to this wishlist</p>
          )}
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
import { data } from 'react-router';
