import { Icon } from '../icon';

export function WishGiftLabel({ state }: { state: 'reserved' | 'bought' }) {
  return (
    <span className="wish-gift-label">
      <Icon name="tick" /> {state === 'bought' ? 'Bought' : 'Reserved'}
    </span>
  );
}
