import { Link } from 'react-router';

import type { FamilyWishlist } from '../lib/db/wishlists';

type WishlistTag = Pick<FamilyWishlist, 'id' | 'owner' | 'isOwn'>;

type FamilyWishlistTagsProps = {
  wishlists: WishlistTag[];
  activeWishlistId?: string;
};

export function FamilyWishlistTags({ wishlists, activeWishlistId }: FamilyWishlistTagsProps) {
  return (
    <nav aria-label="Choose a family wishlist" className="family-tags">
      {wishlists.map((wishlist) => (
        <div key={wishlist.id} className="family-tag-wrap">
          <Link
            to={`/?list=${encodeURIComponent(wishlist.id)}`}
            preventScrollReset
            className="family-tag"
            aria-current={activeWishlistId === wishlist.id ? 'page' : undefined}
          >
            <span>{wishlist.owner.displayName}</span>
            {wishlist.isOwn ? <small>My wishlist</small> : null}
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
      ))}
    </nav>
  );
}
