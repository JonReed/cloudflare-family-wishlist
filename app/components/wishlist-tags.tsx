import { Link } from 'react-router';

export type WishlistTag = {
  id: string;
  displayName: string;
  to: string;
  isOwn?: boolean;
};

type WishlistTagsProps = {
  wishlists: WishlistTag[];
  ariaLabel: string;
  activeWishlistId?: string;
  preventScrollReset?: boolean;
};

export function WishlistTags({
  wishlists,
  ariaLabel,
  activeWishlistId,
  preventScrollReset = false
}: WishlistTagsProps) {
  return (
    <nav aria-label={ariaLabel} className="family-tags">
      {wishlists.map((wishlist) => (
        <div key={wishlist.id} className="family-tag-wrap">
          <Link
            to={wishlist.to}
            preventScrollReset={preventScrollReset}
            className="family-tag"
            aria-current={activeWishlistId === wishlist.id ? 'page' : undefined}
          >
            <span>{wishlist.displayName}</span>
            {wishlist.isOwn ? <small>My wishlist</small> : null}
            <img
              src="/shared-assets/tag-string-hanging.png"
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
