import { renderToStaticMarkup } from 'react-dom/server';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vitest';

import { FamilyWishlistTags } from '../app/components/family-wishlist-tags';

describe('family wishlist tags', () => {
  it("labels only the signed-in member's wishlist", () => {
    const Routes = createRoutesStub([
      {
        path: '/',
        Component: () => (
          <FamilyWishlistTags
            activeWishlistId="list-2"
            wishlists={[
              {
                id: 'list-1',
                owner: { id: 'member-1', displayName: 'Alex' },
                isOwn: true
              },
              {
                id: 'list-2',
                owner: { id: 'member-2', displayName: 'Jamie' },
                isOwn: false
              }
            ]}
          />
        )
      }
    ]);

    const html = renderToStaticMarkup(<Routes initialEntries={['/']} />);

    expect(html).toContain('Alex</span><small>My wishlist</small>');
    expect(html).toContain('Jamie</span><img');
    expect(html).not.toContain('Their wishlist');
    expect(html).not.toContain('Your wishlist');
    expect(html).toContain('aria-current="page" href="/?list=list-2"');
    expect(html.match(/My wishlist/g)).toHaveLength(1);
  });
});
