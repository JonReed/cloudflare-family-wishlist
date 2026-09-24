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
