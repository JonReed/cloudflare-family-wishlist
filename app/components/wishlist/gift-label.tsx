export function WishGiftLabel({ state }: { state: 'reserved' | 'bought' }) {
  return (
    <span className="wish-gift-label">
      <span aria-hidden="true">✓</span> {state === 'bought' ? 'Bought' : 'Reserved'}
    </span>
  );
}
