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
