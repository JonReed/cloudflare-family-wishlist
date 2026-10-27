import { data, redirect } from 'react-router';

import { Brand } from '../components/brand';
import { WishlistTags } from '../components/wishlist-tags';
import { SiteFooter } from '../components/site-footer';
import { WishGiftLabel } from '../components/wishlist/gift-label';
import { WishTitle } from '../components/wishlist/wish-title';
import { cloudflareContext } from '../lib/context';
import {
  changeGuestClaim,
  consumeGuestClaimBudget,
  GuestClaimLimitError
} from '../lib/db/guest-claims';
import { secureMutationRequest } from '../lib/request-security';
import {
  getSharedWishlists,
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
    const token = params.token;
    if (!token) notFound();
    const wishlists = await getSharedWishlists(env.DB, token);
    if (!wishlists.length) notFound();
    return data({ wishlists, token });
  } catch (error) {
    if (error instanceof SharedWishlistInputError) {
      notFound();
    }
    throw error;
  }
}

export function headers({ loaderHeaders, actionHeaders }: Route.HeadersArgs) {
  const result = new Headers(loaderHeaders);
  actionHeaders.forEach((value, name) => result.set(name, value));
  return result;
}

export async function action({ context, params, request }: Route.ActionArgs) {
  if (request.method !== 'POST') return data({ error: 'Method not allowed' }, { status: 405 });
  const secured = await secureMutationRequest(request, {
    allowDevelopmentOrigin: import.meta.env.DEV
  });
  const { env } = context.get(cloudflareContext);
  const token = params.token;
  if (!token) notFound();
  const wishlists = await getSharedWishlists(env.DB, token);
  if (!wishlists.length) notFound();
  try {
    const form = await secured.formData();
    const intent = form.get('intent');
    await consumeGuestClaimBudget(env.DB, token);
    const itemId = form.get('itemId');
    if (typeof itemId !== 'string')
      throw new SharedWishlistInputError('Choose a gift from the list.');
    await changeGuestClaim(env.DB, token, itemId, intent);
    return redirect(`/shared/${token}#wish-${itemId}`, { status: 303 });
  } catch (error) {
    if (error instanceof GuestClaimLimitError)
      return data({ error: error.message }, { status: 429, headers: { 'Retry-After': '3600' } });
    if (error instanceof SharedWishlistInputError)
      return data({ error: error.message }, { status: 409 });
    throw error;
  }
}

function GuestClaimControls({ item, token }: { item: SharedWishlistItem; token: string }) {
  const own = item.reservation === 'yours' || item.reservation === 'bought';
  return (
    <div className="guest-claim-controls">
      <p className="guest-claim-status">
        {item.reservation === 'available'
          ? 'Available to give'
          : item.reservation === 'reserved'
            ? 'Reserved'
            : item.reservation === 'bought'
              ? 'You’ve bought this'
              : 'You’re getting this'}
      </p>
      {item.reservation === 'available' || own ? (
        <form method="post" action={`/shared/${token}`}>
          <input type="hidden" name="itemId" value={item.id} />
          {own ? (
            <>
              <button
                className="button-quiet"
                name="intent"
                value={item.reservation === 'bought' ? 'unbought' : 'bought'}
              >
                {item.reservation === 'bought' ? 'Mark as not bought' : 'Mark as bought'}
              </button>
              <button className="button-quiet" name="intent" value="release">
                Leave for someone else
              </button>
            </>
          ) : (
            <button className="button-primary" name="intent" value="claim">
              I’ll get this
            </button>
          )}
        </form>
      ) : null}
    </div>
  );
}

function formatPrice(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(amountMinor / 100);
}

const priorityLabels = { low: 'Nice to have', high: 'Top wish' } as const;

function SharedWish({ item, token }: { item: SharedWishlistItem; token: string }) {
  const isBought = item.reservation === 'bought';
  const isReserved = item.reservation === 'reserved' || item.reservation === 'yours';
  return (
    <li
      id={`wish-${item.id}`}
      className={[
        'wish-row',
        'shared-wish-row',
        `wish-row-${item.priority}`,
        isBought ? 'wish-row-bought' : isReserved ? 'wish-row-reserved' : null
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={item.imageUrl ? 'wish-content wish-content-with-image' : 'wish-content'}>
        {item.imageUrl ? (
          <img
            src={item.imageUrl}
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
            <WishTitle itemId={item.id} title={item.title} />
            {isBought || isReserved ? (
              <WishGiftLabel state={isBought ? 'bought' : 'reserved'} />
            ) : null}
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
      <GuestClaimControls item={item} token={token} />
    </li>
  );
}

export default function SharedWishlistPage({ loaderData, actionData }: Route.ComponentProps) {
  const { wishlists, token } = loaderData;
  const Heading = wishlists.length > 1 ? 'h2' : 'h1';
  return (
    <div className="site-shell public-share-shell">
      <header className="public-share-header page-wrap">
        <span className="brand-link">
          <Brand />
        </span>
      </header>
      <main className="public-share-main page-wrap">
        {actionData?.error ? (
          <p role="alert" className="form-alert">
            {actionData.error}
          </p>
        ) : null}
        {wishlists.length > 1 ? (
          <header className="public-share-overview">
            <p className="section-kicker">Gift ideas</p>
            <h1>Family wishlists</h1>
            <div className="parcel-hero family-board">
              <WishlistTags
                wishlists={wishlists.map((wishlist) => ({
                  id: wishlist.id,
                  displayName: wishlist.ownerDisplayName,
                  to: `#wishlist-${wishlist.id}`
                }))}
                ariaLabel="Shared wishlists"
              />
            </div>
          </header>
        ) : null}
        {wishlists.map((wishlist) => (
          <article
            key={wishlist.id}
            id={`wishlist-${wishlist.id}`}
            className="wishlist-sheet public-share-sheet"
          >
            <span aria-hidden="true" className="paper-tape paper-tape-left" />
            <span aria-hidden="true" className="paper-tape paper-tape-right" />
            <header className="wishlist-heading">
              <div>
                <p className="section-kicker">Gift ideas</p>
                <Heading>{wishlist.ownerDisplayName}’s wishlist</Heading>
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
        ))}
      </main>
      <SiteFooter />
    </div>
  );
}
