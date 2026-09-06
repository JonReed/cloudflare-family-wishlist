import type { FamilyWishlist } from '../../lib/db/wishlists';
import type { Route } from '../../routes/+types/home';
import { ProductDiagnostics } from '../product-diagnostics';
import { AddWishForm } from '../add-wish-form';
import { wishlistFormAction, ActionFields } from './form-fields';
import { ItemFields } from './item-fields';

function clearAddedWishForm(form: HTMLFormElement): void {
  let titleField: HTMLInputElement | null = null;

  for (const name of ['productUrl', 'title', 'imageUrl', 'notes', 'price']) {
    const field = form.elements.namedItem(name);
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
      field.value = '';
      if (name === 'title' && field instanceof HTMLInputElement) titleField = field;
    }
  }

  const priority = form.elements.namedItem('priority');
  if (priority instanceof HTMLSelectElement) priority.value = 'normal';

  // Keep the existing dependency-free product helper in sync with the cleared form.
  for (const name of ['productUrl', 'imageUrl']) {
    const field = form.elements.namedItem(name);
    if (field instanceof HTMLInputElement) {
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  titleField?.focus({ preventScroll: true });
}

export function AddWishPanel({
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
    <>
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
      <ProductDiagnostics
        diagnostics={
          fetchError && actionData && 'diagnostics' in actionData
            ? actionData.diagnostics
            : undefined
        }
      />
    </>
  );

  return (
    <aside className="add-wish-panel" aria-labelledby={`${addFormId}-heading`}>
      <span aria-hidden="true" className="add-panel-tape" />
      <h2 id={`${addFormId}-heading`} tabIndex={-1}>
        {wishlist.isOwn ? 'Add to wishlist' : `Add something for ${wishlist.owner.displayName}`}
      </h2>

      <AddWishForm
        actionKey={`add-wish:${wishlist.id}`}
        method="post"
        action={wishlistFormAction(wishlist.id)}
        className="add-form add-form-sidebar"
        data-product-import-form
        onSuccess={clearAddedWishForm}
      >
        {({ error, isPending, succeeded }) => (
          <>
            <ActionFields wishlistId={wishlist.id} />
            <fieldset className="add-form-fields" disabled={isPending}>
              <ItemFields
                formId={addFormId}
                recipientName={recipientName}
                urlFirst
                draft={fetchedDraft}
                urlAction={urlAction}
                urlStatus={urlStatus}
              />
              <button name="intent" value="add-item" className="button-primary">
                {isPending ? 'Adding…' : 'Add to the list'}
              </button>
            </fieldset>
            <p
              className={
                error ? 'mutation-submit-status mutation-submit-error' : 'mutation-submit-status'
              }
              role="status"
              aria-live="polite"
            >
              {error ??
                (succeeded
                  ? wishlist.isOwn
                    ? 'Added to your wishlist.'
                    : `Added to ${wishlist.owner.displayName}’s wishlist.`
                  : '')}
            </p>
          </>
        )}
      </AddWishForm>
    </aside>
  );
}
