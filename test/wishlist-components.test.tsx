import { renderToStaticMarkup } from 'react-dom/server';
import { createRoutesStub } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { ItemFields } from '../app/components/wishlist/item-fields';
import { WishlistItemRow } from '../app/components/wishlist/item-row';
import { productFormDraft } from '../app/lib/wishlist-form-draft';
import type { FamilyWishlist, WishlistItem } from '../app/lib/db/wishlists';

const ownItem: WishlistItem = {
  id: 'wish-1',
  title: 'A good book',
  notes: null,
  productUrl: null,
  imageUrl: null,
  priceAmountMinor: null,
  priceCurrency: null,
  priority: 'normal',
  position: 0,
  claimVisibility: 'hidden'
};

function rowHtml(item: WishlistItem, isOwn = true, wasJustEdited = false) {
  const wishlist: FamilyWishlist = {
    id: 'list-1',
    owner: { id: 'member-1', displayName: 'Sam' },
    isOwn,
    items: [item]
  };
  const Routes = createRoutesStub([
    {
      path: '/',
      Component: () => (
        <ul>
          <WishlistItemRow
            wishlist={wishlist}
            item={item}
            wasJustEdited={wasJustEdited}
            onItemEdited={vi.fn()}
            onEditorOpened={vi.fn()}
            onRemovalStart={vi.fn()}
            onEditError={vi.fn()}
          />
        </ul>
      )
    }
  ]);
  return renderToStaticMarkup(<Routes initialEntries={['/']} />);
}

describe('extracted wishlist components', () => {
  it('groups buying details and management controls in one footer', () => {
    const html = rowHtml({
      ...ownItem,
      productUrl: 'https://example.com/book',
      priceAmountMinor: 1500,
      priceCurrency: 'GBP'
    });
    expect(html).toContain('<div class="wish-footer"><div class="wish-meta">');
    expect(html).toContain('About £15.00');
    expect(html).toMatch(/See where to find it.*?<\/a><\/div><div class="wish-item-actions">/);
  });

  it('keeps saved feedback outside the edit control and preserves the external shop link', () => {
    const html = rowHtml({ ...ownItem, productUrl: 'https://example.com/book' }, true, true);
    expect(html).toContain('<summary>Edit this wish</summary>');
    expect(html).toContain('aria-live="polite">Changes saved.</span>');
    expect(html).toContain('href="https://example.com/book" target="_blank" rel="noreferrer"');
    expect(html).toContain('See where to find it');
  });

  it('keeps owner rows free of gift coordination and normal-priority labels', () => {
    const html = rowHtml(ownItem);
    expect(html).not.toContain('claim-item');
    expect(html).not.toContain('wish-claim');
    expect(html).not.toContain('class="priority');
    expect(html).toContain('value="edit-item"');
    expect(html).toContain('Yes, remove this wish');
    expect(html).toContain('method="post"');
  });

  it('retains top wish labels and unclaimed gift-giver controls', () => {
    const html = rowHtml(
      { ...ownItem, claimVisibility: 'visible', claim: null, priority: 'high' },
      false
    );
    expect(html).toContain('priority-high');
    expect(html).toContain('value="claim-item"');
    expect(html).toContain('I’ll get this');
  });

  it('preserves add-field hooks and the ordering of priority choices', () => {
    const html = renderToStaticMarkup(
      <ItemFields formId="add-list" recipientName="you" urlFirst />
    );
    expect(html).toContain('data-product-url');
    expect(html).toContain('data-product-title');
    expect(html.indexOf('value="high"')).toBeLessThan(html.indexOf('value="normal"'));
    expect(html.indexOf('value="normal"')).toBeLessThan(html.indexOf('value="low"'));
  });

  it('keeps an existing form draft when product lookup supplies new details', () => {
    const form = new FormData();
    form.set('title', 'My chosen name');
    form.set('price', '12.34');
    form.set('notes', 'Large');
    form.set('priority', 'high');
    expect(
      productFormDraft(form, {
        title: 'Shop name',
        price: '99.99',
        imageUrl: '',
        productUrl: 'https://example.com/product',
        aiAssisted: false
      })
    ).toMatchObject({
      title: 'My chosen name',
      price: '12.34',
      notes: 'Large',
      priority: 'high'
    });
  });
});
