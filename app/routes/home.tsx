import { redirect } from 'react-router';

import { Brand, GiftIcon } from '../components/brand';
import { SiteFooter } from '../components/site-footer';
import { cloudflareContext, identityContext } from '../lib/context';
import { ensureMemberForEmail } from '../lib/db/members';
import {
  claimWishlistItem,
  createWishlistItem,
  deleteWishlistItem,
  listFamilyWishlists,
  setOwnClaimState,
  unclaimWishlistItem,
  updateWishlistItem,
  WishlistInputError,
  type FamilyWishlist,
  type ItemInput,
  type WishlistItem
} from '../lib/db/wishlists';

import type { Route } from './+types/home';

export function meta() {
  return [
    { title: 'Family Wishlist' },
    {
      name: 'description',
      content: 'A private place for family wishlists, without spoiling the surprise.'
    }
  ];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const identity = context.get(identityContext);
  const member = await ensureMemberForEmail(env.DB, identity.email);
  const wishlists = await listFamilyWishlists(env.DB, member.id);
  const requestedWishlistId = new URL(request.url).searchParams.get('list');
  const activeWishlist =
    wishlists.find((wishlist) => wishlist.id === requestedWishlistId) ?? wishlists[0] ?? null;

  return { member, wishlists, activeWishlist };
}

function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  if (typeof value !== 'string') {
    throw new WishlistInputError(`${name} is required.`);
  }

  return value;
}

function itemInput(formData: FormData): ItemInput {
  return {
    title: formData.get('title'),
    notes: formData.get('notes'),
    productUrl: formData.get('productUrl'),
    price: formData.get('price'),
    priority: formData.get('priority')
  };
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const identity = context.get(identityContext);
  const member = await ensureMemberForEmail(env.DB, identity.email);

  try {
    const formData = await request.formData();
    const intent = formString(formData, 'intent');
    const wishlistId = formString(formData, 'wishlistId');

    switch (intent) {
      case 'add-item':
        await createWishlistItem(env.DB, member.id, wishlistId, itemInput(formData));
        break;
      case 'edit-item':
        await updateWishlistItem(env.DB, formString(formData, 'itemId'), itemInput(formData));
        break;
      case 'delete-item':
        await deleteWishlistItem(env.DB, formString(formData, 'itemId'));
        break;
      case 'claim-item':
        await claimWishlistItem(env.DB, member.id, formString(formData, 'itemId'));
        break;
      case 'mark-purchased':
        await setOwnClaimState(env.DB, member.id, formString(formData, 'itemId'), 'purchased');
        break;
      case 'unclaim-item':
        await unclaimWishlistItem(env.DB, member.id, formString(formData, 'itemId'));
        break;
      default:
        throw new WishlistInputError('That action is not supported.');
    }

    return redirect(`/?list=${encodeURIComponent(wishlistId)}#wishlist`);
  } catch (error) {
    if (error instanceof WishlistInputError) {
      return { error: error.message };
    }

    throw error;
  }
}

function formatPrice(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency
  }).format(amountMinor / 100);
}

function priceInputValue(item: WishlistItem): string {
  if (item.priceAmountMinor === null) return '';
  return (item.priceAmountMinor / 100).toFixed(2);
}

function ItemFields({ item, formId }: { item?: WishlistItem; formId: string }) {
  return (
    <div className="form-fields">
      <div>
        <label htmlFor={`${formId}-title`} className="form-label">
          What is it? <span aria-hidden="true">*</span>
        </label>
        <input
          id={`${formId}-title`}
          name="title"
          required
          maxLength={160}
          defaultValue={item?.title}
          className="form-control"
          placeholder="A book, cosy socks, the good chocolate…"
        />
      </div>

      <div>
        <label htmlFor={`${formId}-notes`} className="form-label">
          Notes
        </label>
        <textarea
          id={`${formId}-notes`}
          name="notes"
          rows={3}
          maxLength={2000}
          defaultValue={item?.notes ?? ''}
          className="form-control resize-y"
          placeholder="Colour, size, edition, or anything else worth knowing"
        />
      </div>

      <div className="form-split">
        <div>
          <label htmlFor={`${formId}-url`} className="form-label">
            Product link
          </label>
          <input
            id={`${formId}-url`}
            name="productUrl"
            type="url"
            maxLength={2048}
            defaultValue={item?.productUrl ?? ''}
            className="form-control"
            placeholder="https://…"
          />
        </div>
        <div>
          <label htmlFor={`${formId}-price`} className="form-label">
            Approximate price
          </label>
          <div className="price-field">
            <span aria-hidden="true">£</span>
            <input
              id={`${formId}-price`}
              name="price"
              inputMode="decimal"
              pattern="(?:0|[1-9][0-9]{0,6})(?:\.[0-9]{1,2})?"
              defaultValue={item ? priceInputValue(item) : ''}
              className="form-control"
              placeholder="24.50"
            />
          </div>
        </div>
      </div>

      <div>
        <label htmlFor={`${formId}-priority`} className="form-label">
          How much is it wanted?
        </label>
        <select
          id={`${formId}-priority`}
          name="priority"
          defaultValue={item?.priority ?? 'normal'}
          className="form-control"
        >
          <option value="low">Nice to have</option>
          <option value="normal">Would love</option>
          <option value="high">Top wish</option>
        </select>
      </div>
    </div>
  );
}

function ActionFields({ wishlistId, itemId }: { wishlistId: string; itemId?: string }) {
  return (
    <>
      <input type="hidden" name="wishlistId" value={wishlistId} />
      {itemId ? <input type="hidden" name="itemId" value={itemId} /> : null}
    </>
  );
}

function ClaimControls({ wishlist, item }: { wishlist: FamilyWishlist; item: WishlistItem }) {
  if (wishlist.isOwn || item.claimVisibility === 'hidden') return null;

  if (!item.claim) {
    return (
      <form method="post" action="?index">
        <ActionFields wishlistId={wishlist.id} itemId={item.id} />
        <button name="intent" value="claim-item" className="button-secondary">
          I’ll get this
        </button>
      </form>
    );
  }

  const isPurchased = item.claim.state === 'purchased';

  return (
    <div className="claim-note">
      <p>
        <span className="claim-tick" aria-hidden="true">
          ✓
        </span>
        {isPurchased ? 'Bought' : 'Claimed'} by{' '}
        {item.claim.isClaimedByViewer ? 'you' : item.claim.claimedByDisplayName}
      </p>
      {item.claim.isClaimedByViewer ? (
        <div className="claim-actions">
          {!isPurchased ? (
            <form method="post" action="?index">
              <ActionFields wishlistId={wishlist.id} itemId={item.id} />
              <button name="intent" value="mark-purchased" className="button-small">
                Mark bought
              </button>
            </form>
          ) : null}
          <form method="post" action="?index">
            <ActionFields wishlistId={wishlist.id} itemId={item.id} />
            <button name="intent" value="unclaim-item" className="button-quiet">
              {isPurchased ? 'Undo and release' : 'Release claim'}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

const priorityLabels = {
  low: 'Nice to have',
  normal: 'Would love',
  high: 'Top wish'
} as const;

function WishlistItemRow({ wishlist, item }: { wishlist: FamilyWishlist; item: WishlistItem }) {
  const formId = `edit-${item.id}`;

  return (
    <li className={`wish-row wish-row-${item.priority}`}>
      <div className="wish-content">
        <div className="wish-heading">
          <h3>{item.title}</h3>
          <span className={`priority priority-${item.priority}`}>
            {priorityLabels[item.priority]}
          </span>
        </div>

        {item.notes ? <p className="wish-notes">{item.notes}</p> : null}

        <div className="wish-meta">
          {item.priceAmountMinor !== null && item.priceCurrency ? (
            <span>About {formatPrice(item.priceAmountMinor, item.priceCurrency)}</span>
          ) : null}
          {item.productUrl ? (
            <a href={item.productUrl} target="_blank" rel="noreferrer">
              View the idea <span aria-hidden="true">↗</span>
            </a>
          ) : null}
        </div>

        <details className="edit-panel">
          <summary>Edit this wish</summary>
          <form method="post" action="?index" className="edit-form">
            <ActionFields wishlistId={wishlist.id} itemId={item.id} />
            <ItemFields item={item} formId={formId} />
            <div className="form-actions">
              <button name="intent" value="edit-item" className="button-primary">
                Save changes
              </button>
              <button name="intent" value="delete-item" className="button-danger">
                Delete item
              </button>
            </div>
          </form>
        </details>
      </div>

      <div className="wish-claim">
        <ClaimControls wishlist={wishlist} item={item} />
      </div>
    </li>
  );
}

function WishlistSheet({ wishlist }: { wishlist: FamilyWishlist }) {
  const addFormId = `add-${wishlist.id}`;
  const possessiveName = wishlist.isOwn ? 'Your' : `${wishlist.owner.displayName}’s`;

  return (
    <article id="wishlist" className="wishlist-sheet">
      <span aria-hidden="true" className="paper-tape paper-tape-left" />
      <span aria-hidden="true" className="paper-tape paper-tape-right" />

      <header className="wishlist-heading">
        <div>
          <p className="section-kicker">{wishlist.isOwn ? 'Your one and only' : 'Their ideas'}</p>
          <h2>{possessiveName} wishlist</h2>
        </div>
        <p className="wish-count">
          {wishlist.items.length} {wishlist.items.length === 1 ? 'wish' : 'wishes'}
        </p>
      </header>

      {wishlist.isOwn ? (
        <p className="surprise-note">
          <span aria-hidden="true">Psst…</span> other people’s claims are hidden here, so your
          surprises stay surprising.
        </p>
      ) : (
        <p className="giver-note">
          Claim something when you plan to buy it. {wishlist.owner.displayName} won’t see a thing.
        </p>
      )}

      {wishlist.items.length ? (
        <ul className="wish-list">
          {wishlist.items.map((item) => (
            <WishlistItemRow key={item.id} wishlist={wishlist} item={item} />
          ))}
        </ul>
      ) : (
        <div className="empty-list">
          <GiftIcon className="size-10" />
          <div>
            <h3>A lovely blank page</h3>
            <p>Add the first idea below. Anyone in the family can lend a hand.</p>
          </div>
        </div>
      )}

      <details className="add-wish">
        <summary>
          <span aria-hidden="true">＋</span>
          Add a wish for {wishlist.owner.displayName}
        </summary>
        <form method="post" action="?index" className="add-form">
          <ActionFields wishlistId={wishlist.id} />
          <ItemFields formId={addFormId} />
          <button name="intent" value="add-item" className="button-primary">
            Add to the list
          </button>
        </form>
      </details>
    </article>
  );
}

export default function Home({ loaderData, actionData }: Route.ComponentProps) {
  const { member, wishlists, activeWishlist } = loaderData;

  return (
    <div className="site-shell">
      <header className="site-header page-wrap">
        <a href="/" className="brand-link" aria-label="Family Wishlist home">
          <Brand />
        </a>

        <div className="account-links">
          <span>
            Hello, <strong>{member.displayName}</strong>
          </span>
          <a href="/cdn-cgi/access/logout">Sign out</a>
        </div>
      </header>

      <main>
        <section className="parcel-hero page-wrap" aria-labelledby="page-title">
          <div className="hero-copy-block">
            <p className="section-kicker hero-kicker">One list each, shared with the family</p>
            <h1 id="page-title">What would make their day?</h1>
            <p className="hero-intro">
              Keep everyone’s gift ideas together. When you’re buying, quietly claim a wish so
              nobody doubles up—and the recipient never gets a spoiler.
            </p>
          </div>
        </section>

        <div className="content-wrap page-wrap">
          <section className="family-picker" aria-labelledby="family-picker-title">
            <div className="picker-intro">
              <p className="section-kicker">The family</p>
              <h2 id="family-picker-title">Whose list?</h2>
              <p>Pick a gift tag to see their ideas.</p>
            </div>

            <nav aria-label="Family wishlists" className="family-tags">
              {wishlists.map((wishlist) => {
                const isActive = activeWishlist?.id === wishlist.id;

                return (
                  <a
                    key={wishlist.id}
                    href={`/?list=${encodeURIComponent(wishlist.id)}#wishlist`}
                    className="family-tag"
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span>{wishlist.owner.displayName}</span>
                    {wishlist.isOwn ? <small>Your list</small> : <small>View wishes</small>}
                  </a>
                );
              })}
            </nav>
          </section>

          {actionData?.error ? (
            <div role="alert" className="form-alert">
              <strong>That didn’t quite work.</strong> {actionData.error}
            </div>
          ) : null}

          {activeWishlist ? (
            <WishlistSheet wishlist={activeWishlist} />
          ) : (
            <section className="wishlist-sheet no-lists">
              <h2>No family lists yet</h2>
              <p>Your list will be created automatically when you next sign in.</p>
            </section>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
