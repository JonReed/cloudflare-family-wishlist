import { renderToStaticMarkup } from 'react-dom/server';
import { createRoutesStub } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { RemoveWishForm } from '../app/components/remove-wish-form';
import { StopSharingForm } from '../app/components/stop-sharing-form';

describe('destructive action confirmations', () => {
  it('keeps wish deletion behind a closed native disclosure and separate form', () => {
    const Routes = createRoutesStub([
      {
        path: '/',
        Component: () => (
          <RemoveWishForm
            wishlistId="list-1"
            itemId="item-1"
            title={'A <special> wish'}
            onRemovalStart={vi.fn()}
            onRemovalError={vi.fn()}
          />
        )
      }
    ]);
    const html = renderToStaticMarkup(<Routes initialEntries={['/']} />);
    expect(html).toContain('<summary>Remove</summary>');
    expect(html).not.toContain(' open');
    expect(html).toContain('A &lt;special&gt; wish');
    expect(html).toContain('This cannot be undone.');
    expect(html).toContain('Yes, remove this wish');
    expect(html).toContain('method="post"');
    expect(html).toContain('name="itemId" value="item-1"');
    expect(html).toContain('name="wishlistId" value="list-1"');
    expect(html).toContain('value="delete-item"');
    expect(html).toContain('name="enhancedEdit" value="false"');
    expect(html).not.toContain('required');
  });

  it('requires a second explicit action to invalidate a sharing link without JavaScript', () => {
    const Routes = createRoutesStub([
      {
        path: '/',
        Component: () => (
          <StopSharingForm
            shareLinkId="share-1"
            onRemovalStart={vi.fn()}
            onRemovalError={vi.fn()}
          />
        )
      }
    ]);
    const html = renderToStaticMarkup(<Routes initialEntries={['/']} />);
    expect(html).toContain('<summary>Stop sharing this link</summary>');
    expect(html).not.toContain(' open');
    expect(html).toContain('Yes, stop sharing this link');
    expect(html).toContain('Your wishlist will stay here.');
    expect(html).toContain('name="shareLinkId" value="share-1"');
    expect(html).toContain('name="enhancedRemoval" value="false"');
    expect(html).toContain('method="post"');
    expect(html).toContain('action="/profile"');
  });
});
