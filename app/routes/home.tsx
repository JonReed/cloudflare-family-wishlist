import type { Route } from './+types/home';
import { cloudflareContext, identityContext, organiserEmailForRequest } from '../lib/context';
import { ensureMemberForEmail } from '../lib/db/members';
import {
  listFamilyWishlists,
  WishlistInputError,
  type ItemInput,
  createWishlistItem,
  updateWishlistItem,
  deleteWishlistItem,
  claimWishlistItem,
  setOwnClaimState,
  unclaimWishlistItem
} from '../lib/db/wishlists';
import {
  countWishlistShareLinks,
  normaliseWishlistShareLinkName,
  createWishlistShareLink,
  SharedWishlistInputError
} from '../lib/db/shared-wishlists';
import { consumeProductLookupBudget, ProductLookupRateLimitError } from '../lib/db/product-lookups';
import {
  fetchProductMetadata,
  createBrowserRunProductRenderer,
  createWorkersAiProductExtractor,
  ProductMetadataError
} from '../lib/product-metadata';
import { productFormDraft } from '../lib/wishlist-form-draft';
import {
  ensurePublicSharingAccess,
  PublicSharingAccessError
} from '../lib/cloudflare/access-public-sharing';
import { redirect, Link } from 'react-router';
import { SiteHeader } from '../components/site-header';
import { WishlistSheet } from '../components/wishlist/sheet';
import { AddWishPanel } from '../components/wishlist/add-panel';
import { SiteFooter } from '../components/site-footer';

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
            renderPage: createBrowserRunProductRenderer(env.BROWSER),
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
            fetchError: error.message,
            diagnostics: error instanceof ProductMetadataError ? error.diagnostics : undefined
          };
        }
      }
      case 'add-item':
        await createWishlistItem(env.DB, member.id, wishlistId, itemInput(formData));
        if (formData.get('enhancedAdd') === 'true') {
          return { wishlistId, updated: 'add' as const };
        }
        break;
      case 'edit-item': {
        const itemId = formString(formData, 'itemId');
        await updateWishlistItem(env.DB, itemId, itemInput(formData));
        if (formData.get('enhancedEdit') === 'true') {
          return { wishlistId, itemId, updated: 'edit' as const };
        }
        break;
      }
      case 'delete-item': {
        const itemId = formString(formData, 'itemId');
        await deleteWishlistItem(env.DB, itemId);
        if (formData.get('enhancedEdit') === 'true') {
          return { wishlistId, itemId, updated: 'delete' as const };
        }
        break;
      }
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
                  <Link
                    to={`/?list=${encodeURIComponent(wishlist.id)}`}
                    preventScrollReset
                    className="family-tag"
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <span>{wishlist.owner.displayName}</span>
                    {wishlist.isOwn ? <small>Your wishlist</small> : <small>Their wishlist</small>}
                    <img
                      src="/images/tag-string-hanging.png"
                      alt=""
                      width="384"
                      height="256"
                      className="tag-string"
                      draggable="false"
                    />
                  </Link>
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
                key={activeWishlist.id}
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
