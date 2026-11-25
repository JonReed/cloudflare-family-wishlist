import type { FamilyWishlist, WishlistItem } from '../../lib/db/wishlists';
import { useEffect, useRef } from 'react';
import { GuestReservationDialog } from './guest-reservation-dialog';
import { InPlaceActionForm } from '../in-place-action-form';
import { wishlistFormAction, ActionFields } from './form-fields';

type ClaimProps = { wishlist: FamilyWishlist; item: WishlistItem };

export function ClaimStatus({
  wishlist,
  item,
  eligibleBuyers
}: ClaimProps & { eligibleBuyers: FamilyWishlist['owner'][] }) {
  const submittedRow = useRef<HTMLElement | null>(null);
  const isGuest =
    !wishlist.isOwn && item.claimVisibility === 'visible' && item.claim?.claimedByMemberId === null;
  useEffect(() => {
    const row = submittedRow.current;
    if (isGuest || !row) return;
    submittedRow.current = null;
    if (document.activeElement === document.body) {
      const target =
        row.querySelector<HTMLElement>('.wish-gift-status') ??
        row.querySelector<HTMLElement>('.wish-gift-actions button');
      target?.focus({ preventScroll: true });
    }
  }, [isGuest]);
  if (wishlist.isOwn || item.claimVisibility === 'hidden' || !item.claim) return null;
  const bought = item.claim.state === 'purchased';
  const text = item.claim.isClaimedByViewer
    ? bought
      ? 'You’ve bought this'
      : 'You’re getting this'
    : bought
      ? `${item.claim.claimedByDisplayName} has bought this`
      : `${item.claim.claimedByDisplayName} is getting this`;
  const status = (
    <p className="wish-gift-status" role="status" tabIndex={-1}>
      {text}
    </p>
  );
  if (!isGuest) return status;
  return (
    <div className="guest-reservation-status">
      {status}
      <GuestReservationDialog
        wishlistId={wishlist.id}
        item={item}
        reservedAt={item.claim.guestReservedAt}
        eligibleBuyers={eligibleBuyers}
        onSubmit={(form) => {
          submittedRow.current = form.closest('.wish-row');
        }}
      />
    </div>
  );
}

export function ClaimControls({ wishlist, item }: ClaimProps) {
  if (wishlist.isOwn || item.claimVisibility === 'hidden') return null;
  if (item.claim && !item.claim.isClaimedByViewer) return null;
  const bought = item.claim?.state === 'purchased';
  const intent = !item.claim ? 'claim-item' : bought ? 'mark-not-purchased' : 'mark-purchased';
  const label = !item.claim ? 'I’ll get this' : bought ? 'Mark as not bought' : 'Mark as bought';
  return (
    <InPlaceActionForm
      method="post"
      action={wishlistFormAction(wishlist.id)}
      actionKey={`gift:${item.id}`}
      className="wish-gift-actions"
    >
      {({ isPending, submittedIntent }) => (
        <>
          <ActionFields wishlistId={wishlist.id} itemId={item.id} />
          <button
            name="intent"
            value={intent}
            className={bought ? 'button-text' : 'button-quiet'}
            disabled={isPending}
          >
            {isPending && submittedIntent === intent ? 'Saving…' : label}
          </button>
          {item.claim && !bought ? (
            <button name="intent" value="unclaim-item" className="button-text" disabled={isPending}>
              {isPending && submittedIntent === 'unclaim-item' ? 'Saving…' : 'Cancel claim'}
            </button>
          ) : null}
        </>
      )}
    </InPlaceActionForm>
  );
}
