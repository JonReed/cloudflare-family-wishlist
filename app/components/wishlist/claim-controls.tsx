import type { FamilyWishlist, WishlistItem } from '../../lib/db/wishlists';
import { InPlaceActionForm } from '../in-place-action-form';
import { wishlistFormAction, ActionFields } from './form-fields';

export function ClaimControls({
  wishlist,
  item
}: {
  wishlist: FamilyWishlist;
  item: WishlistItem;
}) {
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
