import { data, redirect } from 'react-router';

import { Brand } from '../components/brand';
import { SiteFooter } from '../components/site-footer';
import { cloudflareContext } from '../lib/context';
import {
  createGuestSecret,
  guestCookie,
  hashGuestSecret,
  readGuestSecret,
  validGuestSecret
} from '../lib/guest-identity';
import {
  changeGuestClaim,
  consumeGuestClaimBudget,
  GuestClaimLimitError,
  hasGuestClaims
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

export async function loader({ context, params, request }: Route.LoaderArgs) {
  try {
    const { env } = context.get(cloudflareContext);
    const token = params.token;
    if (!token) notFound();
    const secret = readGuestSecret(request) ?? createGuestSecret();
    const wishlists = await getSharedWishlists(env.DB, token, await hashGuestSecret(secret));
    if (!wishlists.length) notFound();
    return data(
      { wishlists, token, recoveryCode: secret },
      { headers: { 'Set-Cookie': guestCookie(request, secret) } }
    );
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
  if (!token || !(await getSharedWishlists(env.DB, token)).length) notFound();
  try {
    const secret = readGuestSecret(secured);
    if (!secret)
      throw new SharedWishlistInputError(
        'Allow cookies, then refresh this page before reserving a gift.'
      );
    const guestHash = await hashGuestSecret(secret);
    await consumeGuestClaimBudget(env.DB, token, guestHash);
    const form = await secured.formData();
    const intent = form.get('intent');
    if (intent === 'recover') {
      const code = form.get('recoveryCode');
      if (
        !validGuestSecret(code) ||
        !(await hasGuestClaims(env.DB, token, await hashGuestSecret(code)))
      )
        throw new SharedWishlistInputError(
          'That recovery code has no reservations on this shared list. Check the code and link.'
        );
      return redirect(`/shared/${token}`, {
        status: 303,
        headers: { 'Set-Cookie': guestCookie(request, code) }
      });
    }
    const itemId = form.get('itemId');
    if (typeof itemId !== 'string')
      throw new SharedWishlistInputError('Choose a gift from the list.');
    await changeGuestClaim(env.DB, token, guestHash, itemId, intent);
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

function sharedImagePath(token: string, itemId: string): string {
  return `/shared/${encodeURIComponent(token)}/image/${encodeURIComponent(itemId)}`;
}

function SharedWish({ item, token }: { item: SharedWishlistItem; token: string }) {
  return (
    <li id={`wish-${item.id}`} className={`wish-row shared-wish-row wish-row-${item.priority}`}>
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
      <GuestClaimControls item={item} token={token} />
    </li>
  );
}

export default function SharedWishlistPage({ loaderData, actionData }: Route.ComponentProps) {
  const { wishlists, token, recoveryCode } = loaderData;
  const Heading = wishlists.length > 1 ? 'h2' : 'h1';
  return (
    <div className="site-shell public-share-shell">
      <header className="public-share-header page-wrap">
        <span className="brand-link">
          <Brand />
        </span>
      </header>
      <main className="public-share-main page-wrap">
        <section className="guest-sharing-intro" aria-label="Giving a gift">
          <p>Choose a gift and reserve it so nobody else buys the same thing. No sign-in needed.</p>
          <p>
            Everyone with this link can see which gifts are reserved, including the wishlist owner.
          </p>
          {actionData?.error ? (
            <p role="alert" className="form-error">
              {actionData.error}
            </p>
          ) : null}
          <details className="guest-recovery">
            <summary>Keep or recover your reservations</summary>
            <p>
              This browser remembers your reservations. Save this private code to manage them on
              another device. Anyone with it can manage your reservations.
            </p>
            <label>
              Your recovery code
              <input
                aria-label="Your recovery code"
                readOnly
                value={recoveryCode}
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <form method="post" action={`/shared/${token}`}>
              <label>
                Have a saved code?
                <input
                  name="recoveryCode"
                  required
                  minLength={43}
                  maxLength={43}
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              <button className="button-quiet" name="intent" value="recover">
                Recover my reservations
              </button>
            </form>
            <p>
              Recovering replaces this browser’s current code. Save it first if you already have
              reservations here.
            </p>
          </details>
        </section>
        {wishlists.length > 1 ? (
          <header className="public-share-overview">
            <p className="section-kicker">Gift ideas</p>
            <h1>Family wishlists</h1>
            <nav aria-label="Shared wishlists">
              {wishlists.map((wishlist) => (
                <a key={wishlist.id} href={`#wishlist-${wishlist.id}`} className="button-quiet">
                  {wishlist.ownerDisplayName}
                </a>
              ))}
            </nav>
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
