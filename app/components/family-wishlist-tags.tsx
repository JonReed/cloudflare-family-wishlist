import { Link } from 'react-router';

import type { SharedWishlist } from '../lib/db/shared-wishlists';
import type { FamilyWishlist } from '../lib/db/wishlists';

type WishlistTag = Pick<FamilyWishlist, 'id' | 'owner' | 'isOwn'>;

type FamilyWishlistTagsProps = {
  wishlists: WishlistTag[];
  activeWishlistId?: string;
};

function TagContents({
  name,
  isOwn = false,
  stringSrc
}: {
  name: string;
  isOwn?: boolean;
  stringSrc: string;
}) {
  return (
    <>
      <span>{name}</span>
      {isOwn ? <small>My wishlist</small> : null}
      <img
        src={stringSrc}
        alt=""
        width="384"
        height="256"
        className="tag-string"
        draggable="false"
      />
    </>
  );
}

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
            <TagContents
              name={wishlist.owner.displayName}
              isOwn={wishlist.isOwn}
              stringSrc="/images/tag-string-hanging.png"
            />
          </Link>
        </div>
      ))}
    </nav>
  );
}

export function SharedWishlistTags({
  wishlists
}: {
  wishlists: Pick<SharedWishlist, 'id' | 'ownerDisplayName'>[];
}) {
  return (
    <nav aria-label="Shared wishlists" className="family-tags">
      {wishlists.map((wishlist) => (
        <div key={wishlist.id} className="family-tag-wrap">
          <a href={`#wishlist-${wishlist.id}`} className="family-tag">
            <TagContents
              name={wishlist.ownerDisplayName}
              stringSrc="/shared-assets/tag-string-hanging.png"
            />
          </a>
        </div>
      ))}
    </nav>
  );
}
