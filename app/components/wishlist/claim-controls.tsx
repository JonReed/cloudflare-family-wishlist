import type { FamilyWishlist, WishlistItem } from '../../lib/db/wishlists';
import { InPlaceActionForm } from '../in-place-action-form';
import { wishlistFormAction, ActionFields } from './form-fields';

type ClaimProps = { wishlist: FamilyWishlist; item: WishlistItem };

export function ClaimStatus({ wishlist, item }: ClaimProps) {
  if (wishlist.isOwn || item.claimVisibility === 'hidden' || !item.claim) return null;
  const bought = item.claim.state === 'purchased';
  const text = item.claim.isClaimedByViewer
    ? bought
      ? 'You’ve bought this'
      : 'You’re getting this'
    : bought
      ? `${item.claim.claimedByDisplayName} has bought this`
      : `${item.claim.claimedByDisplayName} is getting this`;
  return (
    <p className="wish-gift-status" role="status">
      {text}
    </p>
  );
}

export function ClaimControls({
  wishlist,
  item,
  eligibleBuyers
}: ClaimProps & {
  eligibleBuyers: FamilyWishlist['owner'][];
}) {
  if (wishlist.isOwn || item.claimVisibility === 'hidden') return null;
  if (item.claim && !item.claim.claimedByMemberId) {
    const reservedAt = item.claim.guestReservedAt;
    const clearReservation = (
      <details className="guest-claim-controls">
        <summary>Clear a guest reservation</summary>
        <p>Clearing makes this gift available again. Check with the guest first.</p>
        <form method="post" action={wishlistFormAction(wishlist.id)}>
          <ActionFields wishlistId={wishlist.id} itemId={item.id} />
          <button className="button-quiet" name="intent" value="release-guest">
            Yes, clear this reservation
          </button>
        </form>
      </details>
    );
    if (!eligibleBuyers.length || !reservedAt) return clearReservation;
    return (
      <details className="guest-claim-controls">
        <summary>Manage guest reservation</summary>
        <InPlaceActionForm
          method="post"
          action={wishlistFormAction(wishlist.id)}
          actionKey={`assign:${item.id}`}
          className="assign-guest-form"
        >
          {({ isPending }) => (
            <>
              <ActionFields wishlistId={wishlist.id} itemId={item.id} />
              <input type="hidden" name="guestReservedAt" value={reservedAt} />
              <div>
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
              </div>
              <button
                className="button-primary"
                name="intent"
                value="assign-guest"
                disabled={isPending}
              >
                {isPending ? 'Assigning…' : 'Assign reservation'}
              </button>
            </>
          )}
        </InPlaceActionForm>
        {clearReservation}
      </details>
    );
  }
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
