// Browsers use the first submit button for Enter, even when a secondary lookup appears first visually.
export function DefaultAddWishSubmit({ disabled = false }: { disabled?: boolean }) {
  return (
    <button type="submit" name="intent" value="add-item" hidden disabled={disabled}>
      Add wish
    </button>
  );
}

export function ActionFields({ wishlistId, itemId }: { wishlistId: string; itemId?: string }) {
  return (
    <>
      <input type="hidden" name="wishlistId" value={wishlistId} />
      {itemId ? <input type="hidden" name="itemId" value={itemId} /> : null}
    </>
  );
}

export function wishlistFormAction(wishlistId: string): string {
  return `?index&list=${encodeURIComponent(wishlistId)}`;
}
