import type { FamilyWishlist, WishlistItem } from '../../lib/db/wishlists';
import { useCallback } from 'react';
import { productImagePath } from '../../lib/product-image';
import { ClaimControls } from './claim-controls';
import { EditWishForm } from '../edit-wish-form';
import { wishlistFormAction, ActionFields } from './form-fields';
import { ItemFields } from './item-fields';
import { RemoveWishForm } from '../remove-wish-form';

function formatPrice(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency
  }).format(amountMinor / 100);
}

const priorityLabels = {
  low: 'Nice to have',
  high: 'Top wish'
} as const;

export function WishlistItemRow({
  wishlist,
  item,
  wasJustEdited,
  onItemEdited,
  onEditorOpened,
  onRemovalStart,
  onEditError
}: {
  wishlist: FamilyWishlist;
  item: WishlistItem;
  wasJustEdited: boolean;
  onItemEdited: (itemId: string, form: HTMLFormElement) => void;
  onEditorOpened: () => void;
  onRemovalStart: (itemId: string) => void;
  onEditError: (form: HTMLFormElement) => void;
}) {
  const formId = `edit-${item.id}`;
  const recipientName = wishlist.isOwn ? 'you' : wishlist.owner.displayName;
  const hasClaimControls = !wishlist.isOwn && item.claimVisibility === 'visible';
  const handleEditSuccess = useCallback(
    (form: HTMLFormElement) => onItemEdited(item.id, form),
    [item.id, onItemEdited]
  );

  return (
    <li
      data-wish-id={item.id}
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

      <div className="wish-item-actions">
        <details
          className="edit-panel"
          onToggle={(event) => {
            if (event.currentTarget.open) onEditorOpened();
          }}
        >
          <summary>
            <span className="edit-summary-label">Edit this wish</span>
            <span className="edit-saved-status" role="status" aria-live="polite">
              {wasJustEdited ? 'Changes saved.' : ''}
            </span>
          </summary>
          <EditWishForm
            actionKey={`edit-wish:${item.id}`}
            method="post"
            action={wishlistFormAction(wishlist.id)}
            className="edit-form"
            onSubmissionError={onEditError}
            onSuccess={handleEditSuccess}
          >
            {({ error, isPending, submittedIntent }) => {
              const isSaving = isPending && submittedIntent === 'edit-item';

              return (
                <>
                  <ActionFields wishlistId={wishlist.id} itemId={item.id} />
                  <fieldset className="edit-form-fields" disabled={isPending}>
                    <ItemFields item={item} formId={formId} recipientName={recipientName} />
                    <div className="form-actions">
                      <button name="intent" value="edit-item" className="button-primary">
                        {isSaving ? 'Saving…' : 'Save changes'}
                      </button>
                    </div>
                  </fieldset>
                  <p
                    className={
                      error
                        ? 'mutation-submit-status mutation-submit-error'
                        : 'mutation-submit-status'
                    }
                    role={error ? 'alert' : 'status'}
                    aria-live="polite"
                    tabIndex={error ? -1 : undefined}
                  >
                    {error}
                  </p>
                </>
              );
            }}
          </EditWishForm>
        </details>
        <RemoveWishForm
          wishlistId={wishlist.id}
          itemId={item.id}
          title={item.title}
          onRemovalStart={onRemovalStart}
          onRemovalError={onEditError}
        />
      </div>
    </li>
  );
}
