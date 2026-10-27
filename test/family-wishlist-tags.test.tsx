import { renderToStaticMarkup } from 'react-dom/server';
import { createRoutesStub } from 'react-router';
import { describe, expect, it } from 'vitest';

import { WishlistTags } from '../app/components/wishlist-tags';

describe('wishlist tags', () => {
  it("labels only the signed-in member's wishlist", () => {
    const Routes = createRoutesStub([
      {
        path: '/',
        Component: () => (
          <WishlistTags
            ariaLabel="Choose a family wishlist"
            activeWishlistId="list-2"
            preventScrollReset
            wishlists={[
              {
                id: 'list-1',
                displayName: 'Alex',
                to: '/?list=list-1',
                isOwn: true
              },
              {
                id: 'list-2',
                displayName: 'Jamie',
                to: '/?list=list-2',
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
    expect(html).toContain('src="/shared-assets/tag-string-hanging.png"');
    expect(html.match(/My wishlist/g)).toHaveLength(1);
  });

  it('renders the same tags for a shared page with wishlist anchors', () => {
    const Routes = createRoutesStub([
      {
        path: '/shared/:token',
        Component: () => (
          <WishlistTags
            ariaLabel="Shared wishlists"
            wishlists={[
              { id: 'list-1', displayName: 'Alex', to: '#wishlist-list-1' },
              { id: 'list-2', displayName: 'Jamie', to: '#wishlist-list-2' }
            ]}
          />
        )
      }
    ]);

    const html = renderToStaticMarkup(<Routes initialEntries={['/shared/token']} />);

    expect(html).toContain('aria-label="Shared wishlists" class="family-tags"');
    expect(html).toContain('href="/shared/token#wishlist-list-1"');
    expect(html).toContain('href="/shared/token#wishlist-list-2"');
    expect(html.match(/src="\/shared-assets\/tag-string-hanging.png"/g)).toHaveLength(2);
  });
});
