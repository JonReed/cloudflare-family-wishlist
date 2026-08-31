import { redirect } from 'react-router';

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

export async function loader({ context }: Route.LoaderArgs) {
  const { env } = context.get(cloudflareContext);
  const identity = context.get(identityContext);
  const member = await ensureMemberForEmail(env.DB, identity.email);

  return {
    member,
    wishlists: await listFamilyWishlists(env.DB, member.id)
  };
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

    return redirect(`/#wishlist-${encodeURIComponent(wishlistId)}`);
  } catch (error) {
    if (error instanceof WishlistInputError) {
      return { error: error.message };
    }

    throw error;
  }
}

function GiftIcon({ className = 'size-5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
    >
      <path d="M4 10h16v10H4zM2.8 6.5h18.4V10H2.8zM12 6.5V20" />
      <path d="M11.8 6.3C9.8 6.3 7.2 5.5 7.2 3.7c0-1 .8-1.7 1.8-1.5 1.7.3 2.6 2.3 2.8 4.1ZM12.2 6.3c2 0 4.6-.8 4.6-2.6 0-1-.8-1.7-1.8-1.5-1.7.3-2.6 2.3-2.8 4.1Z" />
    </svg>
  );
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
    <div className="grid gap-4">
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

      <div className="grid gap-4 sm:grid-cols-2">
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
          <div className="relative">
            <span className="text-ink-muted pointer-events-none absolute top-1/2 left-4 -translate-y-1/2">
              £
            </span>
            <input
              id={`${formId}-price`}
              name="price"
              inputMode="decimal"
              pattern="(?:0|[1-9][0-9]{0,6})(?:\.[0-9]{1,2})?"
              defaultValue={item ? priceInputValue(item) : ''}
              className="form-control pl-8"
              placeholder="24.50"
            />
          </div>
        </div>
      </div>

      <div>
        <label htmlFor={`${formId}-priority`} className="form-label">
          Priority
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
    <div className="border-leaf/15 bg-mint/18 rounded-2xl border p-4">
      <p className="text-leaf text-sm font-bold">
        {isPurchased ? 'Bought' : 'Claimed'} by{' '}
        {item.claim.isClaimedByViewer ? 'you' : item.claim.claimedByDisplayName}
      </p>
      {item.claim.isClaimedByViewer ? (
        <div className="mt-3 flex flex-wrap gap-2">
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

function WishlistItemCard({ wishlist, item }: { wishlist: FamilyWishlist; item: WishlistItem }) {
  const formId = `edit-${item.id}`;
  const priorityLabels = {
    low: 'Nice to have',
    normal: 'Would love',
    high: 'Top wish'
  } as const;

  return (
    <li className="border-ink/10 bg-paper rounded-[1.5rem] border p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-display text-ink text-2xl font-semibold tracking-tight">
              {item.title}
            </h3>
            <span className={`priority priority-${item.priority}`}>
              {priorityLabels[item.priority]}
            </span>
          </div>
          {item.notes ? (
            <p className="text-ink-muted mt-3 max-w-2xl leading-7 whitespace-pre-wrap">
              {item.notes}
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm font-semibold">
            {item.priceAmountMinor !== null && item.priceCurrency ? (
              <span className="text-ink">
                Around {formatPrice(item.priceAmountMinor, item.priceCurrency)}
              </span>
            ) : null}
            {item.productUrl ? (
              <a
                href={item.productUrl}
                target="_blank"
                rel="noreferrer"
                className="text-leaf focus-visible:outline-leaf rounded-sm underline decoration-2 underline-offset-4 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-4"
              >
                View product <span aria-hidden="true">↗</span>
              </a>
            ) : null}
          </div>
        </div>

        <div className="shrink-0">
          <ClaimControls wishlist={wishlist} item={item} />
        </div>
      </div>

      <details className="border-ink/10 mt-5 border-t pt-4">
        <summary className="text-ink-muted hover:text-leaf focus-visible:outline-leaf cursor-pointer rounded-sm text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-4">
          Edit item
        </summary>
        <form method="post" action="?index" className="mt-5">
          <ActionFields wishlistId={wishlist.id} itemId={item.id} />
          <ItemFields item={item} formId={formId} />
          <div className="mt-5 flex flex-wrap gap-3">
            <button name="intent" value="edit-item" className="button-primary">
              Save changes
            </button>
            <button name="intent" value="delete-item" className="button-danger">
              Delete item
            </button>
          </div>
        </form>
      </details>
    </li>
  );
}

function WishlistCard({ wishlist }: { wishlist: FamilyWishlist }) {
  const addFormId = `add-${wishlist.id}`;

  return (
    <article
      id={`wishlist-${wishlist.id}`}
      className="border-ink/8 bg-canvas/75 scroll-mt-6 rounded-[2rem] border p-5 shadow-sm sm:p-8"
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-leaf text-xs font-bold tracking-[0.16em] uppercase">
            {wishlist.isOwn ? 'Your wishlist' : 'Family wishlist'}
          </p>
          <h2 className="font-display text-ink mt-1 text-4xl font-semibold tracking-tight">
            {wishlist.owner.displayName}
          </h2>
        </div>
        <p className="text-ink-muted text-sm font-semibold">
          {wishlist.items.length} {wishlist.items.length === 1 ? 'wish' : 'wishes'}
        </p>
      </header>

      {wishlist.isOwn ? (
        <p className="border-peach bg-peach/35 text-rust mt-5 rounded-2xl border px-4 py-3 text-sm leading-6 font-semibold">
          Claim information is deliberately absent from your view. Surprises remain intact.
        </p>
      ) : null}

      {wishlist.items.length ? (
        <ul className="mt-6 grid list-none gap-4 p-0">
          {wishlist.items.map((item) => (
            <WishlistItemCard key={item.id} wishlist={wishlist} item={item} />
          ))}
        </ul>
      ) : (
        <div className="border-ink/10 bg-paper mt-6 rounded-[1.5rem] border border-dashed px-6 py-10 text-center">
          <GiftIcon className="text-mint mx-auto size-10" />
          <p className="font-display text-ink mt-4 text-2xl font-semibold">
            Nothing wished for yet
          </p>
          <p className="text-ink-muted mx-auto mt-2 max-w-md leading-7">
            Add the first idea below. Everyone in the family can help keep this list useful.
          </p>
        </div>
      )}

      <details className="border-leaf/15 bg-paper mt-6 rounded-[1.5rem] border p-5 sm:p-6">
        <summary className="text-leaf focus-visible:outline-leaf cursor-pointer rounded-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-4">
          Add a wish for {wishlist.owner.displayName}
        </summary>
        <form method="post" action="?index" className="mt-5">
          <ActionFields wishlistId={wishlist.id} />
          <ItemFields formId={addFormId} />
          <button name="intent" value="add-item" className="button-primary mt-5">
            Add to wishlist
          </button>
        </form>
      </details>
    </article>
  );
}

export default function Home({ loaderData, actionData }: Route.ComponentProps) {
  const { member, wishlists } = loaderData;

  return (
    <main className="min-h-screen overflow-hidden">
      <div aria-hidden="true" className="page-glow page-glow-one" />
      <div aria-hidden="true" className="page-glow page-glow-two" />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-6 sm:px-8">
        <a
          href="/"
          className="focus-visible:outline-leaf inline-flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          <span className="bg-leaf text-paper grid size-10 place-items-center rounded-2xl shadow-sm">
            <GiftIcon />
          </span>
          <span className="font-display text-ink text-xl font-semibold tracking-tight">
            Family Wishlist
          </span>
        </a>
        <span className="border-leaf/15 bg-paper/70 text-leaf inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold shadow-sm backdrop-blur sm:px-4">
          <span className="bg-mint size-2 rounded-full" />
          <span className="hidden sm:inline">Signed in as </span>
          {member.displayName}
        </span>
      </header>

      <section className="relative z-10 mx-auto max-w-6xl px-5 pt-10 pb-20 sm:px-8 sm:pt-16">
        <div className="max-w-3xl">
          <p className="bg-peach/65 text-rust mb-4 inline-flex items-center rounded-full px-4 py-2 text-sm font-bold tracking-wide">
            One list each, shared with the family
          </p>
          <h1 className="font-display text-ink text-5xl leading-none font-semibold tracking-[-0.045em] text-balance sm:text-7xl">
            What would make their day?
          </h1>
          <p className="text-ink-muted mt-6 max-w-2xl text-lg leading-8">
            Add and tidy ideas together. Claims are visible to gift-givers and kept completely out
            of sight on the recipient’s own list.
          </p>
        </div>

        <nav aria-label="Family wishlists" className="mt-8 flex flex-wrap gap-2">
          {wishlists.map((wishlist) => (
            <a
              key={wishlist.id}
              href={`#wishlist-${wishlist.id}`}
              className="border-ink/10 bg-paper text-ink hover:border-leaf/30 hover:text-leaf focus-visible:outline-leaf rounded-full border px-4 py-2 text-sm font-bold shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              {wishlist.owner.displayName}
              {wishlist.isOwn ? ' (you)' : ''}
            </a>
          ))}
        </nav>

        {actionData?.error ? (
          <div
            role="alert"
            className="border-rust/20 bg-peach/50 text-rust mt-6 rounded-2xl border p-4 font-semibold"
          >
            {actionData.error}
          </div>
        ) : null}

        <div className="mt-8 grid gap-8">
          {wishlists.map((wishlist) => (
            <WishlistCard key={wishlist.id} wishlist={wishlist} />
          ))}
        </div>
      </section>
    </main>
  );
}
