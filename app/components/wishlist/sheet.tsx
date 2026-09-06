import type { FamilyWishlist } from '../../lib/db/wishlists';
import { useState, useRef, useCallback, useEffect } from 'react';
import { ShareWishlistPanel } from './share-panel';
import { WishlistItemRow } from './item-row';

function focusEditedWishSummary(form: HTMLFormElement): void {
  const editor = form.closest('details');
  if (editor) editor.open = false;
  const summary = editor?.querySelector('summary');
  if (summary instanceof HTMLElement) summary.focus({ preventScroll: true });
}

function focusEditError(form: HTMLFormElement): void {
  const error = form.querySelector('.mutation-submit-error');
  if (error instanceof HTMLElement) error.focus({ preventScroll: true });
}

export function WishlistSheet({
  wishlist,
  shareLinkCount,
  shareLinkName,
  shareUrl
}: {
  wishlist: FamilyWishlist;
  shareLinkCount: number;
  shareLinkName?: string;
  shareUrl?: string;
}) {
  const [lastEditedItemId, setLastEditedItemId] = useState<string | null>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const removalRef = useRef<{ itemId: string; candidates: string[] } | null>(null);
  const possessiveName = wishlist.isOwn ? 'Your' : `${wishlist.owner.displayName}’s`;
  const handleItemEdited = useCallback((itemId: string, form: HTMLFormElement) => {
    setLastEditedItemId(itemId);
    focusEditedWishSummary(form);
  }, []);
  const handleEditorOpened = useCallback(() => setLastEditedItemId(null), []);
  const handleRemovalStart = (itemId: string) => {
    const ids = wishlist.items.map((item) => item.id);
    const index = ids.indexOf(itemId);
    removalRef.current = {
      itemId,
      candidates: [...ids.slice(index + 1), ...ids.slice(0, index).reverse()]
    };
  };
  const handleEditError = useCallback((form: HTMLFormElement) => {
    removalRef.current = null;
    focusEditError(form);
  }, []);

  useEffect(() => {
    const removal = removalRef.current;
    const sheet = sheetRef.current;
    if (!removal || !sheet || wishlist.items.some((item) => item.id === removal.itemId)) return;
    removalRef.current = null;

    // The removed editor unmounts during revalidation, so its parent restores focus.
    // Do not interrupt someone who moved to another control while the request was pending.
    if (document.activeElement !== document.body) return;
    const nextId = removal.candidates.find((id) => wishlist.items.some((item) => item.id === id));
    const target = nextId
      ? sheet.querySelector<HTMLElement>(`[data-wish-id="${nextId}"] .edit-panel > summary`)
      : (sheet.querySelector<HTMLElement>('.empty-list') ??
        sheet.querySelector<HTMLElement>('.wishlist-heading h2'));
    target?.focus({ preventScroll: true });
  }, [wishlist.items]);

  return (
    <article ref={sheetRef} id="wishlist" className="wishlist-sheet">
      <span aria-hidden="true" className="paper-tape paper-tape-left" />
      <span aria-hidden="true" className="paper-tape paper-tape-right" />

      <header className="wishlist-heading">
        <div>
          <h2 tabIndex={-1}>{possessiveName} wishlist</h2>
        </div>
        <div className="wishlist-heading-tools">
          <p className="wish-count">
            {wishlist.items.length} {wishlist.items.length === 1 ? 'wish' : 'wishes'}
          </p>
          <a className="add-wish-shortcut" href={`#add-${wishlist.id}-heading`}>
            Add a wish
          </a>
          <ShareWishlistPanel
            wishlist={wishlist}
            linkCount={shareLinkCount}
            shareLinkName={shareLinkName}
            shareUrl={shareUrl}
          />
        </div>
      </header>

      {!wishlist.isOwn ? (
        <p className="giver-note">
          Thinking of buying something? Let the family know on the list.{' '}
          {wishlist.owner.displayName} won’t see a thing.
        </p>
      ) : null}

      {wishlist.items.length ? (
        <ul className="wish-list">
          {wishlist.items.map((item) => (
            <WishlistItemRow
              key={item.id}
              wishlist={wishlist}
              item={item}
              wasJustEdited={lastEditedItemId === item.id}
              onItemEdited={handleItemEdited}
              onEditorOpened={handleEditorOpened}
              onRemovalStart={handleRemovalStart}
              onEditError={handleEditError}
            />
          ))}
        </ul>
      ) : (
        <p className="empty-list" tabIndex={-1}>
          Nothing added to this wishlist
        </p>
      )}
    </article>
  );
}
