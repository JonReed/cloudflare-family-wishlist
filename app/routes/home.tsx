import { redirect } from 'react-router';

import { InPlaceActionForm } from '../components/in-place-action-form';
import { ProductImageField } from '../components/product-image-field';
import { SiteFooter } from '../components/site-footer';
import { SiteHeader } from '../components/site-header';
import { cloudflareContext, identityContext, organiserEmailForRequest } from '../lib/context';
import {
  ensurePublicSharingAccess,
  PublicSharingAccessError
} from '../lib/cloudflare/access-public-sharing';
import { ensureMemberForEmail } from '../lib/db/members';
import { consumeProductLookupBudget, ProductLookupRateLimitError } from '../lib/db/product-lookups';
import {
  createWorkersAiProductExtractor,
  fetchProductMetadata,
  ProductMetadataError,
  type ProductMetadata
} from '../lib/product-metadata';
import { productImagePath } from '../lib/product-image';
import {
  countWishlistShareLinks,
  createWishlistShareLink,
  normaliseWishlistShareLinkName,
  SharedWishlistInputError
} from '../lib/db/shared-wishlists';
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
  const member = await ensureMemberForEmail(
    env.DB,
    identity.email,
    organiserEmailForRequest(env, identity.email)
  );
  const wishlists = await listFamilyWishlists(env.DB, member.id);
  const requestedWishlistId = new URL(request.url).searchParams.get('list');
  const activeWishlist =
    wishlists.find((wishlist) => wishlist.id === requestedWishlistId) ?? wishlists[0] ?? null;
  const shareLinkCount = activeWishlist
    ? await countWishlistShareLinks(env.DB, activeWishlist.id)
    : 0;

  return { member, wishlists, activeWishlist, shareLinkCount };
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
  const member = await ensureMemberForEmail(
    env.DB,
    identity.email,
    organiserEmailForRequest(env, identity.email)
  );

  try {
    const formData = await request.formData();
    const intent = formString(formData, 'intent');
    const wishlistId = formString(formData, 'wishlistId');

    switch (intent) {
      case 'fetch-product': {
        const productUrl = formData.get('productUrl');

        try {
          await consumeProductLookupBudget(env.DB, member.id);
          const product = await fetchProductMetadata(productUrl, new URL(request.url).hostname, {
            extractWithAi:
              String(env.PRODUCT_AI_ENABLED).toLowerCase() === 'true'
                ? createWorkersAiProductExtractor(env.AI, env.PRODUCT_AI_MODEL)
                : undefined
          });
          return { wishlistId, product: productFormDraft(formData, product), fetchError: null };
        } catch (error) {
          if (!(
            error instanceof ProductMetadataError || error instanceof ProductLookupRateLimitError
          )) {
            throw error;
          }

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
        return { wishlistId, updated: 'claim' as const };
      case 'mark-purchased':
        await setOwnClaimState(env.DB, member.id, formString(formData, 'itemId'), 'purchased');
        return { wishlistId, updated: 'purchase' as const };
      case 'unclaim-item':
        await unclaimWishlistItem(env.DB, member.id, formString(formData, 'itemId'));
        return { wishlistId, updated: 'unclaim' as const };
      case 'create-share-link': {
        const shareLinkName = normaliseWishlistShareLinkName(formData.get('shareLinkName'));
        if (!import.meta.env.DEV) {
          await ensurePublicSharingAccess(env, new URL(request.url).hostname);
        }
        const token = await createWishlistShareLink(env.DB, member.id, wishlistId, shareLinkName);
        const shareUrl = new URL(`/shared/${token}`, request.url).toString();
        return { wishlistId, shareLinkName, shareUrl };
      }
      default:
        throw new WishlistInputError(
          'We couldn’t work out what to do. Refresh the page and try again.'
        );
    }

    return redirect(`/?list=${encodeURIComponent(wishlistId)}#wishlist`);
  } catch (error) {
    if (
      error instanceof WishlistInputError ||
      error instanceof SharedWishlistInputError ||
      error instanceof PublicSharingAccessError
    ) {
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
  urlAction,
  urlStatus
}: {
  item?: WishlistItem;
  formId: string;
  recipientName: string;
  urlFirst?: boolean;
  draft?: ProductFormDraft;
  urlAction?: React.ReactNode;
  urlStatus?: React.ReactNode;
}) {
  const priorityField = (
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
        <option value="high">Top wish</option>
        <option value="normal">Would love</option>
        <option value="low">Nice to have</option>
      </select>
    </div>
  );
  const urlField = (
    <div>
      <label htmlFor={`${formId}-url`} className="form-label">
        {urlFirst ? 'Start with a link' : 'Where can we find it?'}
      </label>
      <div className={urlFirst ? 'product-link-field' : undefined}>
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
        {urlFirst ? urlAction : null}
      </div>
      {urlFirst ? urlStatus : null}
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
          rows={urlFirst ? 2 : 3}
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
        {urlFirst ? priorityField : null}
      </div>

      {urlFirst ? null : priorityField}
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
      <InPlaceActionForm
        method="post"
        action={wishlistFormAction(wishlist.id)}
        actionKey={`claim:${item.id}`}
      >
        {({ isPending }) => (
          <>
            <ActionFields wishlistId={wishlist.id} itemId={item.id} />
            <button
              name="intent"
              value="claim-item"
              className="button-secondary"
              disabled={isPending}
            >
              {isPending ? 'Saving…' : 'I’ll get this'}
            </button>
          </>
        )}
      </InPlaceActionForm>
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
            <InPlaceActionForm
              method="post"
              action={wishlistFormAction(wishlist.id)}
              actionKey={`purchase:${item.id}`}
            >
              {({ isPending }) => (
                <>
                  <ActionFields wishlistId={wishlist.id} itemId={item.id} />
                  <button
                    name="intent"
                    value="mark-purchased"
                    className="button-small"
                    disabled={isPending}
                  >
                    {isPending ? 'Saving…' : 'I’ve bought it'}
                  </button>
                </>
              )}
            </InPlaceActionForm>
          ) : null}
          <InPlaceActionForm
            method="post"
            action={wishlistFormAction(wishlist.id)}
            actionKey={`unclaim:${item.id}`}
          >
            {({ isPending }) => (
              <>
                <ActionFields wishlistId={wishlist.id} itemId={item.id} />
                <button
                  name="intent"
                  value="unclaim-item"
                  className="button-quiet"
                  disabled={isPending}
                >
                  {isPending ? 'Saving…' : 'I’m not getting this'}
                </button>
              </>
            )}
          </InPlaceActionForm>
        </div>
      ) : null}
    </div>
  );
}

const priorityLabels = {
  low: 'Nice to have',
  high: 'Top wish'
} as const;

function WishlistItemRow({ wishlist, item }: { wishlist: FamilyWishlist; item: WishlistItem }) {
  const formId = `edit-${item.id}`;
  const recipientName = wishlist.isOwn ? 'you' : wishlist.owner.displayName;
  const hasClaimControls = !wishlist.isOwn && item.claimVisibility === 'visible';

  return (
    <li
      className={[
        'wish-row',
        `wish-row-${item.priority}`,
        hasClaimControls ? 'wish-row-with-claim' : null
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={item.imageUrl ? 'wish-content wish-content-with-image' : 'wish-content'}>
        {item.imageUrl ? (
          <img
            src={productImagePath(item.imageUrl)}
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

      {hasClaimControls ? (
        <div className="wish-claim" aria-live="polite">
          <ClaimControls wishlist={wishlist} item={item} />
        </div>
      ) : null}

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
    </li>
  );
}

function ShareWishlistPanel({
  wishlist,
  linkCount,
  shareLinkName,
  shareUrl
}: {
  wishlist: FamilyWishlist;
  linkCount: number;
  shareLinkName?: string;
  shareUrl?: string;
}) {
  const active = linkCount > 0;
  const atLimit = linkCount >= 5;

  return (
    <details id="sharing" className="share-panel" open={Boolean(shareUrl)} data-share-panel>
      <summary>
        {active
          ? `${linkCount} sharing ${linkCount === 1 ? 'link' : 'links'} active`
          : 'Share this list'}
      </summary>
      <div className="share-panel-body">
        <a
          href={wishlistFormAction(wishlist.id)}
          className="share-panel-close"
          aria-label="Close sharing options"
          data-close-share-panel
        >
          <span aria-hidden="true">×</span>
        </a>
        <p>
          {active
            ? `${linkCount} active sharing ${linkCount === 1 ? 'link' : 'links'} out of 5. Anyone you send one to can see this wishlist.`
            : 'Make a sharing link for relatives and friends outside your family.'}
        </p>

        {shareUrl ? (
          <div className="share-link-result">
            {shareLinkName ? <p className="share-link-name">{shareLinkName} is ready.</p> : null}
            <label htmlFor={`share-link-${wishlist.id}`} className="form-label">
              Copy and share this link
            </label>
            <div className="share-link-copy">
              <input
                id={`share-link-${wishlist.id}`}
                className="form-control"
                value={shareUrl}
                readOnly
                data-share-link
              />
              <button type="button" className="button-secondary" data-copy-share-link>
                Copy link
              </button>
            </div>
            <p className="share-copy-status" role="status" aria-live="polite" />
          </div>
        ) : null}

        {atLimit ? (
          <div className="share-limit-message" role="status">
            <strong>You already have five sharing links for this wishlist.</strong>
            <p>
              To make another, first{' '}
              <a href="/profile#shared-lists">stop sharing one from Profile</a>.
            </p>
          </div>
        ) : (
          <>
            <form
              method="post"
              action={wishlistFormAction(wishlist.id)}
              className="share-link-form"
            >
              <ActionFields wishlistId={wishlist.id} />
              <div>
                <label htmlFor={`share-link-name-${wishlist.id}`} className="form-label">
                  Who is this link for?
                </label>
                <input
                  id={`share-link-name-${wishlist.id}`}
                  name="shareLinkName"
                  required
                  maxLength={80}
                  className="form-control"
                  placeholder="Uncle David"
                  aria-describedby={`share-link-name-hint-${wishlist.id}`}
                />
                <p id={`share-link-name-hint-${wishlist.id}`} className="share-link-hint">
                  This name is private and helps your family find the right link later.
                </p>
              </div>
              <button name="intent" value="create-share-link" className="button-secondary">
                {active ? 'Create another sharing link' : 'Create sharing link'}
              </button>
            </form>
            {active ? (
              <p className="share-panel-manage">
                See or stop sharing existing links from <a href="/profile#shared-lists">Profile</a>.
              </p>
            ) : null}
          </>
        )}
      </div>
    </details>
  );
}

function WishlistSheet({
  wishlist,
  shareLinkCount,
  shareLinkName,
  shareUrl
}: {
  wishlist: FamilyWishlist;
  shareLinkCount: number;
  shareLinkName?: string;
  shareUrl?: string;
}) {
  const possessiveName = wishlist.isOwn ? 'Your' : `${wishlist.owner.displayName}’s`;

  return (
    <article id="wishlist" className="wishlist-sheet">
      <span aria-hidden="true" className="paper-tape paper-tape-left" />
      <span aria-hidden="true" className="paper-tape paper-tape-right" />

      <header className="wishlist-heading">
        <div>
          <h2>{possessiveName} wishlist</h2>
        </div>
        <div className="wishlist-heading-tools">
          <p className="wish-count">
            {wishlist.items.length} {wishlist.items.length === 1 ? 'wish' : 'wishes'}
          </p>
          <ShareWishlistPanel
            wishlist={wishlist}
            linkCount={shareLinkCount}
            shareLinkName={shareLinkName}
            shareUrl={shareUrl}
          />
        </div>
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
  const urlAction = (
    <button
      name="intent"
      value="fetch-product"
      className="button-secondary product-fetch-button"
      formNoValidate
      data-product-fetch
    >
      Fill from link
    </button>
  );
  const urlStatus = (
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
          urlAction={urlAction}
          urlStatus={urlStatus}
        />
        <button name="intent" value="add-item" className="button-primary">
          Add to the list
        </button>
      </form>
    </aside>
  );
}

export default function Home({ loaderData, actionData }: Route.ComponentProps) {
  const { member, wishlists, activeWishlist, shareLinkCount } = loaderData;
  const shareUrl =
    actionData &&
    'shareUrl' in actionData &&
    activeWishlist &&
    actionData.wishlistId === activeWishlist.id
      ? actionData.shareUrl
      : undefined;
  const shareLinkName =
    actionData &&
    'shareLinkName' in actionData &&
    activeWishlist &&
    actionData.wishlistId === activeWishlist.id
      ? actionData.shareLinkName
      : undefined;

  return (
    <div className="site-shell">
      <SiteHeader member={member} current="wishlists" />

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
              <WishlistSheet
                wishlist={activeWishlist}
                shareLinkCount={shareLinkCount}
                shareLinkName={shareLinkName}
                shareUrl={shareUrl}
              />
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
