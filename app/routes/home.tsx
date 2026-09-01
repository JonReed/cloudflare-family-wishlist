import { redirect } from 'react-router';

import { Brand } from '../components/brand';
import { ProductImageField } from '../components/product-image-field';
import { SiteFooter } from '../components/site-footer';
import { cloudflareContext, identityContext } from '../lib/context';
import { ensureMemberForEmail } from '../lib/db/members';
import {
  createWorkersAiProductExtractor,
  fetchProductMetadata,
  ProductMetadataError,
  type ProductMetadata
} from '../lib/product-metadata';
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
    imageUrl: formData.get('imageUrl'),
    price: formData.get('price'),
    priority: formData.get('priority')
  };
}

type ProductFormDraft = ProductMetadata & {
  notes: string;
  priority: 'low' | 'normal' | 'high';
};

function boundedDraftValue(formData: FormData, name: string, maxLength: number): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value.slice(0, maxLength) : '';
}

function isDraftPriority(value: string): value is ProductFormDraft['priority'] {
  return value === 'low' || value === 'normal' || value === 'high';
}

function productFormDraft(
  formData: FormData,
  product: ProductMetadata,
  productUrl = product.productUrl
): ProductFormDraft {
  const existingTitle = boundedDraftValue(formData, 'title', 160);
  const existingPrice = boundedDraftValue(formData, 'price', 32);
  const existingImageUrl = boundedDraftValue(formData, 'imageUrl', 2048);
  const rawPriority = boundedDraftValue(formData, 'priority', 16);

  return {
    ...product,
    productUrl,
    title: existingTitle.trim() ? existingTitle : product.title,
    price: existingPrice.trim() ? existingPrice : product.price,
    imageUrl: existingImageUrl.trim() ? existingImageUrl : product.imageUrl,
    notes: boundedDraftValue(formData, 'notes', 2000),
    priority: isDraftPriority(rawPriority) ? rawPriority : 'normal'
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
      case 'fetch-product': {
        const productUrl = formData.get('productUrl');

        try {
          const product = await fetchProductMetadata(productUrl, new URL(request.url).hostname, {
            extractWithAi:
              String(env.PRODUCT_AI_ENABLED).toLowerCase() === 'true'
                ? createWorkersAiProductExtractor(env.AI, env.PRODUCT_AI_MODEL)
                : undefined
          });
          return { wishlistId, product: productFormDraft(formData, product), fetchError: null };
        } catch (error) {
          if (!(error instanceof ProductMetadataError)) throw error;

          return {
            wishlistId,
            product: productFormDraft(
              formData,
              { productUrl: '', title: '', price: '', imageUrl: '', aiAssisted: false },
              typeof productUrl === 'string' ? productUrl.slice(0, 2048) : ''
            ),
            fetchError: error.message
          };
        }
      }
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
  urlFirst = false,
  draft,
  urlHelper
}: {
  item?: WishlistItem;
  formId: string;
  recipientName: string;
  urlFirst?: boolean;
  draft?: ProductFormDraft;
  urlHelper?: React.ReactNode;
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
        defaultValue={item?.productUrl ?? draft?.productUrl ?? ''}
        className="form-control"
        placeholder={urlFirst ? 'Paste the shop or product link' : 'https://…'}
        data-product-url={urlFirst ? '' : undefined}
      />
    </div>
  );

  return (
    <div className="form-fields">
      {urlFirst ? urlField : null}
      {urlFirst ? urlHelper : null}

      <div>
        <label htmlFor={`${formId}-title`} className="form-label">
          What would {recipientName} love? <span aria-hidden="true">*</span>
        </label>
        <input
          id={`${formId}-title`}
          name="title"
          required
          maxLength={160}
          defaultValue={item?.title ?? draft?.title}
          className="form-control"
          placeholder="A book, cosy socks, the good chocolate…"
          data-product-title={urlFirst ? '' : undefined}
        />
      </div>

      <ProductImageField formId={formId} defaultValue={item?.imageUrl ?? draft?.imageUrl} />

      <div>
        <label htmlFor={`${formId}-notes`} className="form-label">
          Anything else to know?
        </label>
        <textarea
          id={`${formId}-notes`}
          name="notes"
          rows={3}
          maxLength={2000}
          defaultValue={item?.notes ?? draft?.notes ?? ''}
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
              defaultValue={item ? priceInputValue(item) : (draft?.price ?? '')}
              className="form-control"
              placeholder="0.99"
              data-product-price={urlFirst ? '' : undefined}
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
          defaultValue={item?.priority ?? draft?.priority ?? 'normal'}
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

function wishlistFormAction(wishlistId: string): string {
  return `?index&list=${encodeURIComponent(wishlistId)}`;
}

function ClaimControls({ wishlist, item }: { wishlist: FamilyWishlist; item: WishlistItem }) {
  if (wishlist.isOwn || item.claimVisibility === 'hidden') return null;

  if (!item.claim) {
    return (
      <form method="post" action={wishlistFormAction(wishlist.id)}>
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
            <form method="post" action={wishlistFormAction(wishlist.id)}>
              <ActionFields wishlistId={wishlist.id} itemId={item.id} />
              <button name="intent" value="mark-purchased" className="button-small">
                I’ve bought it
              </button>
            </form>
          ) : null}
          <form method="post" action={wishlistFormAction(wishlist.id)}>
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
        </div>

        <details className="edit-panel">
          <summary>Edit this wish</summary>
          <form method="post" action={wishlistFormAction(wishlist.id)} className="edit-form">
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
          <h2>{possessiveName} wishlist</h2>
        </div>
        <p className="wish-count">
          {wishlist.items.length} {wishlist.items.length === 1 ? 'wish' : 'wishes'}
        </p>
      </header>

      {!wishlist.isOwn ? (
        <p className="giver-note">
          Thinking of buying something? Let the family know on the list.{' '}
          {wishlist.owner.displayName} won’t see a thing.
        </p>
      ) : null}

      {wishlist.items.length ? (
        <ul className="wish-list">
          {wishlist.items.map((item) => (
            <WishlistItemRow key={item.id} wishlist={wishlist} item={item} />
          ))}
        </ul>
      ) : (
        <p className="empty-list">Nothing added to this wishlist</p>
      )}
    </article>
  );
}

function AddWishPanel({
  wishlist,
  actionData
}: {
  wishlist: FamilyWishlist;
  actionData: Route.ComponentProps['actionData'];
}) {
  const addFormId = `add-${wishlist.id}`;
  const recipientName = wishlist.isOwn ? 'you' : wishlist.owner.displayName;
  const fetchedDraft =
    actionData && 'product' in actionData && actionData.wishlistId === wishlist.id
      ? actionData.product
      : undefined;
  const fetchError =
    actionData && 'fetchError' in actionData && actionData.wishlistId === wishlist.id
      ? actionData.fetchError
      : null;
  const urlHelper = (
    <div className="product-fetch-row">
      <button
        name="intent"
        value="fetch-product"
        className="button-secondary product-fetch-button"
        formNoValidate
        data-product-fetch
      >
        Fill from link
      </button>
      <p
        className={fetchError ? 'product-fetch-status product-fetch-error' : 'product-fetch-status'}
        role="status"
        aria-live="polite"
        data-product-status
      >
        {fetchError ??
          (fetchedDraft
            ? fetchedDraft.aiAssisted
              ? 'We found some details with a little AI help. Check them before adding.'
              : 'We found some details. Check them before adding.'
            : '')}
      </p>
    </div>
  );

  return (
    <aside className="add-wish-panel" aria-labelledby={`${addFormId}-title`}>
      <span aria-hidden="true" className="add-panel-tape" />
      <h2 id={`${addFormId}-title`}>
        {wishlist.isOwn ? 'Add to wishlist' : `Add something for ${wishlist.owner.displayName}`}
      </h2>

      <form
        method="post"
        action={wishlistFormAction(wishlist.id)}
        className="add-form add-form-sidebar"
        data-product-import-form
      >
        <ActionFields wishlistId={wishlist.id} />
        <ItemFields
          formId={addFormId}
          recipientName={recipientName}
          urlFirst
          draft={fetchedDraft}
          urlHelper={urlHelper}
        />
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
          <a href="/bookmarklet">Add from anywhere</a>
          {member.role === 'admin' ? <a href="/family">Your family</a> : null}
          <a href="/profile">Profile</a>
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
                    <img
                      src="/images/tag-string-hanging.png"
                      alt=""
                      width="384"
                      height="256"
                      className="tag-string"
                      draggable="false"
                    />
                  </a>
                </div>
              );
            })}
          </nav>
        </section>

        <div className="content-wrap page-wrap">
          {actionData && 'error' in actionData ? (
            <div role="alert" className="form-alert">
              <strong>Sorry, that didn’t work.</strong> {actionData.error}
            </div>
          ) : null}

          {activeWishlist ? (
            <div className="wishlist-workspace">
              <WishlistSheet wishlist={activeWishlist} />
              <AddWishPanel wishlist={activeWishlist} actionData={actionData} />
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
