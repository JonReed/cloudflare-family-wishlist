import { useState } from 'react';
import type { FamilyWishlist, WishlistItem } from '../../lib/db/wishlists';
import { ActionDialog } from '../action-dialog';
import { InPlaceActionForm } from '../in-place-action-form';
import { ActionFields, wishlistFormAction } from './form-fields';

export function GuestReservationDialog({
  wishlistId,
  item,
  eligibleBuyers,
  reservedAt,
  onSubmit
}: {
  wishlistId: string;
  item: WishlistItem;
  eligibleBuyers: FamilyWishlist['owner'][];
  reservedAt?: string;
  onSubmit: (form: HTMLFormElement) => void;
}) {
  const [confirmClear, setConfirmClear] = useState(false);
  const canAssign = eligibleBuyers.length > 0 && !!reservedAt;
  const clearing = !canAssign || confirmClear;

  return (
    <ActionDialog
      className="guest-reservation-dialog"
      trigger="Manage reservation"
      triggerClassName="button-text"
      title={clearing ? 'Clear this reservation?' : 'Manage reservation'}
      compact
      onOpen={() => setConfirmClear(false)}
    >
      {({ enhanced, requestClose }) => (
        <InPlaceActionForm
          method="post"
          action={wishlistFormAction(wishlistId)}
          actionKey={`guest-reservation:${item.id}`}
          preventScrollReset
          onSubmit={(event) => onSubmit(event.currentTarget)}
        >
          {({ isPending }) => {
            const clearWarning = (
              <p>
                Clearing the reservation makes <strong>{item.title}</strong> available for someone
                else to buy.
              </p>
            );
            const clearButton = (
              <button
                className="button-danger"
                name="intent"
                value="release-guest"
                disabled={isPending}
                formNoValidate
              >
                {isPending ? 'Clearing…' : 'Yes, clear reservation'}
              </button>
            );
            const cancel = enhanced && (
              <button
                type="button"
                className="button-quiet"
                disabled={isPending}
                data-dialog-initial-focus={clearing ? '' : undefined}
                ref={confirmClear ? (button) => button?.focus({ preventScroll: true }) : undefined}
                onClick={requestClose}
              >
                Cancel
              </button>
            );
            return (
              <>
                <ActionFields wishlistId={wishlistId} itemId={item.id} />
                {clearing ? (
                  <>
                    {clearWarning}
                    <div className="form-actions">
                      {cancel}
                      {clearButton}
                    </div>
                  </>
                ) : (
                  <>
                    <p>
                      Who is buying <strong>{item.title}</strong>?
                    </p>
                    <input type="hidden" name="guestReservedAt" value={reservedAt} />
                    <label className="form-label" htmlFor={`buyer-${item.id}`}>
                      Gift buyer
                    </label>
                    <select
                      className="form-control"
                      id={`buyer-${item.id}`}
                      name="buyerId"
                      disabled={isPending}
                      required
                      defaultValue=""
                      data-dialog-initial-focus=""
                    >
                      <option value="" disabled>
                        Choose a family member
                      </option>
                      {eligibleBuyers.map((buyer) => (
                        <option key={buyer.id} value={buyer.id}>
                          {buyer.displayName}
                        </option>
                      ))}
                    </select>
                    <div className="form-actions">
                      <button
                        className="button-primary"
                        name="intent"
                        value="assign-guest"
                        disabled={isPending}
                      >
                        {isPending ? 'Assigning…' : 'Assign reservation'}
                      </button>
                      {cancel}
                    </div>
                    {enhanced ? (
                      <button
                        className="button-text"
                        type="button"
                        disabled={isPending}
                        onClick={() => setConfirmClear(true)}
                      >
                        Clear reservation…
                      </button>
                    ) : (
                      <details className="removal-confirmation">
                        <summary>Clear reservation…</summary>
                        {clearWarning}
                        {clearButton}
                      </details>
                    )}
                  </>
                )}
              </>
            );
          }}
        </InPlaceActionForm>
      )}
    </ActionDialog>
  );
}
