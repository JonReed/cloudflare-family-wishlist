import type { ItemPriority } from '../../lib/db/wishlists';
import { Icon } from '../icon';

export function WishPriorityLabel({ priority }: { priority: ItemPriority }) {
  if (priority === 'normal') return null;
  return priority === 'high' ? (
    <span className="priority priority-high">
      <Icon name="star" /> Top wish
    </span>
  ) : (
    <span className="priority priority-low">Nice to have</span>
  );
}
