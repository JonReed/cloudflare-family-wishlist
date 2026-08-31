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
      content: 'Share wishlists with your family without spoiling the surprise.'
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
    throw new WishlistInputError('This page is out of date. Refresh it and try again.');
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
        throw new WishlistInputError(
          'We couldn’t work out what to do. Refresh the page and try again.'
        );
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

function ItemFields({
  item,
  formId,
  recipientName,
  urlFirst = false
}: {
  item?: WishlistItem;
  formId: string;
  recipientName: string;
  urlFirst?: boolean;
}) {
  const urlField = (
    <div>
      <label htmlFor={`${formId}-url`} className="form-label">
        {urlFirst ? 'Start with a link' : 'Where can we find it?'}
      </label>
      <input
        id={`${formId}-url`}
        name="productUrl"
        type="url"
        maxLength={2048}
        defaultValue={item?.productUrl ?? ''}
        className="form-control"
        placeholder={urlFirst ? 'Paste the shop or product link' : 'https://…'}
      />
    </div>
  );

  return (
    <div className="form-fields">
      {urlFirst ? urlField : null}

      <div>
        <label htmlFor={`${formId}-title`} className="form-label">
          What would {recipientName} love? <span aria-hidden="true">*</span>
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
          Anything else to know?
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
        {urlFirst ? null : urlField}
        <div>
          <label htmlFor={`${formId}-price`} className="form-label">
            Rough price
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
          How much would {recipientName} like it?
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
  const claimStatus = item.claim.isClaimedByViewer
    ? isPurchased
      ? 'You’ve bought this'
      : 'You’re getting this'
    : isPurchased
      ? `${item.claim.claimedByDisplayName} has bought this`
      : `${item.claim.claimedByDisplayName} is getting this`;

  return (
    <div className="claim-note">
      <p>
        <span className="claim-tick" aria-hidden="true">
          ✓
        </span>
        {claimStatus}
      </p>
      {item.claim.isClaimedByViewer ? (
        <div className="claim-actions">
          {!isPurchased ? (
            <form method="post" action="?index">
              <ActionFields wishlistId={wishlist.id} itemId={item.id} />
              <button name="intent" value="mark-purchased" className="button-small">
                I’ve bought it
              </button>
            </form>
          ) : null}
          <form method="post" action="?index">
            <ActionFields wishlistId={wishlist.id} itemId={item.id} />
            <button name="intent" value="unclaim-item" className="button-quiet">
              I’m not getting this
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
  const recipientName = wishlist.isOwn ? 'you' : wishlist.owner.displayName;

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
              See where to find it <span aria-hidden="true">↗</span>
            </a>
          ) : null}
        </div>

        <details className="edit-panel">
          <summary>Edit this wish</summary>
          <form method="post" action="?index" className="edit-form">
            <ActionFields wishlistId={wishlist.id} itemId={item.id} />
            <ItemFields item={item} formId={formId} recipientName={recipientName} />
            <div className="form-actions">
              <button name="intent" value="edit-item" className="button-primary">
                Save changes
              </button>
              <button name="intent" value="delete-item" className="button-danger">
                Remove from the list
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
  const possessiveName = wishlist.isOwn ? 'Your' : `${wishlist.owner.displayName}’s`;

  return (
    <article id="wishlist" className="wishlist-sheet">
      <span aria-hidden="true" className="paper-tape paper-tape-left" />
      <span aria-hidden="true" className="paper-tape paper-tape-right" />

      <header className="wishlist-heading">
        <div>
          <p className="section-kicker">
            {wishlist.isOwn ? 'A few things you’d love' : 'A few things they’d love'}
          </p>
          <h2>{possessiveName} wishlist</h2>
        </div>
        <p className="wish-count">
          {wishlist.items.length} {wishlist.items.length === 1 ? 'wish' : 'wishes'}
        </p>
      </header>

      {wishlist.isOwn ? (
        <p className="surprise-note">
          <span aria-hidden="true">Psst…</span> if someone decides to get you something from this
          list, we’ll keep it secret so the surprise isn’t spoiled.
        </p>
      ) : (
        <p className="giver-note">
          Thinking of buying something? Let the family know on the list.{' '}
          {wishlist.owner.displayName} won’t see a thing.
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
            <p>
              Add something {wishlist.isOwn ? 'you’d' : `${wishlist.owner.displayName} would`} love
              to get things started. Anyone in the family can lend a hand.
            </p>
          </div>
        </div>
      )}
    </article>
  );
}

function AddWishPanel({ wishlist }: { wishlist: FamilyWishlist }) {
  const addFormId = `add-${wishlist.id}`;
  const recipientName = wishlist.isOwn ? 'you' : wishlist.owner.displayName;

  return (
    <aside className="add-wish-panel" aria-labelledby={`${addFormId}-title`}>
      <span aria-hidden="true" className="add-panel-tape" />
      <p className="section-kicker">A new idea</p>
      <h2 id={`${addFormId}-title`}>
        {wishlist.isOwn
          ? 'Add to your wishlist'
          : `Add something for ${wishlist.owner.displayName}`}
      </h2>
      <p className="add-panel-intro">
        Start with a link if you have one, then add the useful details.
      </p>

      <form method="post" action="?index" className="add-form add-form-sidebar">
        <ActionFields wishlistId={wishlist.id} />
        <ItemFields formId={addFormId} recipientName={recipientName} urlFirst />
        <button name="intent" value="add-item" className="button-primary">
          Add to the list
        </button>
      </form>
    </aside>
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
        <section className="parcel-hero family-board page-wrap" aria-labelledby="page-title">
          <h1 id="page-title" className="sr-only">
            Family wishlists
          </h1>
          <nav aria-label="Choose a family wishlist" className="family-tags">
            {wishlists.map((wishlist) => {
              const isActive = activeWishlist?.id === wishlist.id;

              return (
                <div key={wishlist.id} className="family-tag-wrap">
                  <span aria-hidden="true" className="tag-string" />
                  <a
                    href={`/?list=${encodeURIComponent(wishlist.id)}#wishlist`}
                    className="family-tag"
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span>{wishlist.owner.displayName}</span>
                    {wishlist.isOwn ? (
                      <small>Your wishlist</small>
                    ) : (
                      <small>See their wishlist</small>
                    )}
                  </a>
                </div>
              );
            })}
          </nav>
        </section>

        <div className="content-wrap page-wrap">
          {actionData?.error ? (
            <div role="alert" className="form-alert">
              <strong>Sorry, that didn’t work.</strong> {actionData.error}
            </div>
          ) : null}

          {activeWishlist ? (
            <div className="wishlist-workspace">
              <WishlistSheet wishlist={activeWishlist} />
              <AddWishPanel wishlist={activeWishlist} />
            </div>
          ) : (
            <section className="wishlist-sheet no-lists">
              <h2>Your wishlist is nearly ready</h2>
              <p>Refresh the page in a moment and it should appear.</p>
            </section>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
