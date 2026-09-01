import { data, Form, redirect, useNavigation } from 'react-router';

import { Brand } from '../components/brand';
import { ProductImageField } from '../components/product-image-field';
import { SiteFooter } from '../components/site-footer';
import { cloudflareContext, identityContext } from '../lib/context';
import { ensureMemberForEmail } from '../lib/db/members';
import { consumeProductLookupBudget, ProductLookupRateLimitError } from '../lib/db/product-lookups';
import {
  createWishlistItems,
  listFamilyWishlists,
  WishlistInputError,
  type ItemInput
} from '../lib/db/wishlists';
import {
  createWorkersAiProductExtractor,
  fetchProductMetadata,
  ProductMetadataError,
  type ProductMetadata
} from '../lib/product-metadata';

import type { Route } from './+types/add';

type ProductDraft = ProductMetadata & {
  notes: string;
  priority: 'low' | 'normal' | 'high';
};

export function meta() {
  return [
    { title: 'Add a wish · Family Wishlist' },
    {
      name: 'description',
      content: 'Add something you found online to one or more family wishlists.'
    }
  ];
}

function blankProduct(productUrl = ''): ProductDraft {
  return {
    productUrl,
    title: '',
    price: '',
    imageUrl: '',
    aiAssisted: false,
    notes: '',
    priority: 'normal'
  };
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

function formValue(formData: FormData, name: string, maxLength: number): string {
  const value = formData.get(name);
  return typeof value === 'string' ? value.slice(0, maxLength) : '';
}

function formDraft(formData: FormData): ProductDraft {
  const priority = formValue(formData, 'priority', 16);

  return {
    productUrl: formValue(formData, 'productUrl', 2048),
    title: formValue(formData, 'title', 160),
    price: formValue(formData, 'price', 10),
    imageUrl: formValue(formData, 'imageUrl', 2048),
    notes: formValue(formData, 'notes', 2000),
    priority: priority === 'low' || priority === 'high' ? priority : 'normal',
    aiAssisted: false
  };
}

export async function loader({ request, context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const identity = context.get(identityContext);
  const member = await ensureMemberForEmail(env.DB, identity.email);
  const wishlists = await listFamilyWishlists(env.DB, member.id);
  const productUrl = new URL(request.url).searchParams.get('url')?.slice(0, 2048) ?? '';

  if (!productUrl) {
    return { member, wishlists, product: blankProduct(), fetchError: null };
  }

  try {
    await consumeProductLookupBudget(env.DB, member.id);
    const product = await fetchProductMetadata(productUrl, new URL(request.url).hostname, {
      extractWithAi:
        String(env.PRODUCT_AI_ENABLED).toLowerCase() === 'true'
          ? createWorkersAiProductExtractor(env.AI, env.PRODUCT_AI_MODEL)
          : undefined
    });

    return {
      member,
      wishlists,
      product: { ...product, notes: '', priority: 'normal' as const },
      fetchError: null
    };
  } catch (error) {
    if (!(error instanceof ProductMetadataError || error instanceof ProductLookupRateLimitError)) {
      throw error;
    }

    return {
      member,
      wishlists,
      product: blankProduct(productUrl),
      fetchError: error.message
    };
  }
}

export async function action({ request, context }: Route.ActionArgs) {
  const { env } = context.get(cloudflareContext);
  const identity = context.get(identityContext);
  const member = await ensureMemberForEmail(env.DB, identity.email);
  const formData = await request.formData();
  const wishlistIds = formData.getAll('wishlistIds');

  try {
    await createWishlistItems(env.DB, member.id, wishlistIds, itemInput(formData));
    const firstWishlistId = wishlistIds.find((value): value is string => typeof value === 'string');

    return redirect(
      firstWishlistId ? `/?list=${encodeURIComponent(firstWishlistId)}#wishlist` : '/#wishlist'
    );
  } catch (error) {
    if (error instanceof WishlistInputError) {
      return data(
        {
          error: error.message,
          draft: formDraft(formData),
          selectedWishlistIds: wishlistIds.filter(
            (wishlistId): wishlistId is string => typeof wishlistId === 'string'
          )
        },
        { status: 400 }
      );
    }

    throw error;
  }
}

export default function AddWish({ loaderData, actionData }: Route.ComponentProps) {
  const { member, wishlists, product, fetchError } = loaderData;
  const draft = actionData?.draft ?? product;
  const selectedWishlistIds = new Set(actionData?.selectedWishlistIds ?? []);
  const navigation = useNavigation();
  const isSaving = navigation.state === 'submitting';

  return (
    <div className="site-shell">
      <header className="site-header page-wrap">
        <a href="/" className="brand-link" aria-label="Family Wishlist home">
          <Brand />
        </a>

        <div className="account-links">
          <a href="/">Wishlists</a>
          <a href="/bookmarklet">Add from anywhere</a>
          {member.role === 'admin' ? <a href="/family">Your family</a> : null}
          <a href="/profile">Profile</a>
        </div>
      </header>

      <main className="profile-main page-wrap">
        <section className="profile-sheet" aria-labelledby="add-wish-title">
          <div className="profile-heading">
            <p className="profile-kicker">Found something lovely?</p>
            <h1 id="add-wish-title">Add it to a wishlist</h1>
            <p>Check one or more family lists, tidy up the details, then save it for later.</p>
          </div>

          <Form method="post" className="profile-form mt-10">
            {actionData?.error ? (
              <div role="alert" className="form-alert profile-alert">
                <strong>Sorry, that didn’t work.</strong> {actionData.error}
              </div>
            ) : null}

            {fetchError ? (
              <div role="status" className="form-alert profile-alert">
                <strong>We couldn’t fill everything in.</strong> {fetchError} You can still add the
                details below.
              </div>
            ) : null}

            <div>
              <label htmlFor="bookmarklet-product-url" className="form-label">
                Product link
              </label>
              <input
                id="bookmarklet-product-url"
                name="productUrl"
                type="url"
                maxLength={2048}
                defaultValue={draft.productUrl}
                className="form-control"
                placeholder="https://…"
              />
            </div>

            <div>
              <label htmlFor="bookmarklet-title" className="form-label">
                What is it? <span aria-hidden="true">*</span>
              </label>
              <input
                id="bookmarklet-title"
                name="title"
                required
                maxLength={160}
                defaultValue={draft.title}
                className="form-control"
                placeholder="A book, cosy socks, the good chocolate…"
              />
            </div>

            <ProductImageField formId="bookmarklet" defaultValue={draft.imageUrl} />

            <div>
              <label htmlFor="bookmarklet-notes" className="form-label">
                Anything else to know?
              </label>
              <textarea
                id="bookmarklet-notes"
                name="notes"
                rows={3}
                maxLength={2000}
                defaultValue={draft.notes}
                className="form-control resize-y"
                placeholder="Colour, size, edition, or anything else worth knowing"
              />
            </div>

            <div className="form-split">
              <div>
                <label htmlFor="bookmarklet-price" className="form-label">
                  Rough price
                </label>
                <div className="price-field">
                  <span aria-hidden="true">£</span>
                  <input
                    id="bookmarklet-price"
                    name="price"
                    inputMode="decimal"
                    maxLength={10}
                    defaultValue={draft.price}
                    className="form-control"
                    placeholder="24.50"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="bookmarklet-priority" className="form-label">
                  How much is it wanted?
                </label>
                <select
                  id="bookmarklet-priority"
                  name="priority"
                  defaultValue={draft.priority}
                  className="form-control"
                >
                  <option value="low">Nice to have</option>
                  <option value="normal">Would love it</option>
                  <option value="high">Top wish</option>
                </select>
              </div>
            </div>

            <fieldset className="border border-[color:var(--line)] bg-[color:var(--warm-white)] p-5">
              <legend className="px-2 text-sm font-extrabold">Whose lists should it go on?</legend>
              <div className="mt-2 grid gap-3 sm:grid-cols-2">
                {wishlists.map((wishlist) => (
                  <label
                    key={wishlist.id}
                    className="flex cursor-pointer items-center gap-3 border-b border-black/10 py-3"
                  >
                    <input
                      type="checkbox"
                      name="wishlistIds"
                      value={wishlist.id}
                      defaultChecked={
                        actionData
                          ? selectedWishlistIds.has(wishlist.id)
                          : wishlist.owner.id === member.id
                      }
                      className="size-5 accent-[color:var(--leaf)]"
                    />
                    <span className="font-bold">
                      {wishlist.owner.displayName}
                      {wishlist.isOwn ? ' (you)' : ''}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="flex flex-wrap gap-3">
              <button type="submit" className="button-primary" disabled={isSaving}>
                {isSaving ? 'Adding…' : 'Add to selected lists'}
              </button>
              <a href="/" className="button-quiet">
                Cancel
              </a>
            </div>
          </Form>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
