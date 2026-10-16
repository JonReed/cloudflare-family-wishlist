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
  it('retains the full saved title and a labelled disclosure for progressive truncation', () => {
    const title = 'A very detailed product name with size, colour and edition information '.repeat(
      2
    );
    const html = rowHtml({ ...ownItem, title });

    expect(html).toContain(`<h3 id="wish-title-wish-1">${title}</h3>`);
    expect(html).toContain('<details class="wish-title-toggle" hidden="">');
    expect(html).toContain('<summary aria-controls="wish-title-wish-1">');
    expect(html).toContain('Show full title');
    expect(html).toContain('Show less');
    expect(html).not.toContain('wish-title-enhanced');
  });

  it('hotlinks product pictures without sending the wishlist referrer', () => {
    const html = rowHtml({ ...ownItem, imageUrl: 'https://cdn.example.com/book.webp' });
    expect(html).toContain('src="https://cdn.example.com/book.webp"');
    expect(html).toContain('referrerPolicy="no-referrer"');
    expect(html).not.toContain('/product-image?');
  });
  it('keeps price with details and puts buying and edit dropdown controls in one footer', () => {
    const html = rowHtml({
      ...ownItem,
      productUrl: 'https://example.com/book',
      priceAmountMinor: 1500,
      priceCurrency: 'GBP'
    });
    expect(html).toContain('<div class="wish-footer"><div class="wish-meta">');
    expect(html).toContain('About £15.00');
    expect(html.indexOf('About £15.00')).toBeLessThan(html.indexOf('class="wish-footer"'));
    expect(html).toContain('class="wish-more"');
    expect(html).toContain(
      '<summary><span>Edit this wish <span aria-hidden="true">▾</span></span></summary>'
    );
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
    expect(html).not.toContain('wish-row-bought');
    expect(html).not.toContain('wish-gift-label');
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
    expect(html.indexOf('class="wish-footer"')).toBeLessThan(html.indexOf('value="claim-item"'));
  });

  it.each(['claimed', 'purchased'] as const)(
    'separates own %s status from compact actions',
    (state) => {
      const html = rowHtml(
        {
          ...ownItem,
          claimVisibility: 'visible',
          claim: {
            state,
            claimedByMemberId: 'giver',
            claimedByDisplayName: 'Alex',
            isClaimedByViewer: true
          }
        },
        false
      );
      expect(html).toContain('class="wish-gift-status"');
      expect(html.indexOf('class="wish-gift-status"')).toBeLessThan(
        html.indexOf('class="wish-footer"')
      );
      if (state === 'claimed') {
        expect(html).not.toContain('wish-row-bought');
        expect(html).not.toContain('wish-gift-label');
        expect(html).toContain('Mark as bought');
        expect(html).toContain('Cancel claim');
      } else {
        expect(html).toContain('wish-row-bought');
        expect(html).toContain(
          '<span class="wish-gift-label"><span aria-hidden="true">✓</span> Bought</span>'
        );
        expect(html).toContain('You’ve bought this');
        expect(html).toContain('Mark as not bought');
        expect(html).toContain('value="mark-not-purchased"');
        expect(html).not.toContain('value="unclaim-item"');
      }
    }
  );

  it.each([
    ['another member', 'giver', 'Alex'],
    ['a guest', null, 'A guest']
  ] as const)(
    'marks a purchase by %s across the row without offering their purchase controls',
    (_giver, memberId, displayName) => {
      const html = rowHtml(
        {
          ...ownItem,
          priority: 'high',
          claimVisibility: 'visible',
          claim: {
            state: 'purchased',
            claimedByMemberId: memberId,
            claimedByDisplayName: displayName,
            isClaimedByViewer: false
          }
        },
        false
      );
      expect(html).toContain('wish-row-bought');
      expect(html).toContain('wish-gift-label');
      expect(html).toContain(`${displayName} has bought this`);
      expect(html).toContain('priority-high');
      expect(html).toContain('Top wish');
      expect(html).not.toContain('value="mark-purchased"');
      expect(html).not.toContain('value="mark-not-purchased"');
    }
  );

  it('omits bought styling and labels when the viewer owns the list or claim visibility is hidden', () => {
    const purchase: WishlistItem = {
      ...ownItem,
      claimVisibility: 'visible',
      claim: {
        state: 'purchased',
        claimedByMemberId: 'giver',
        claimedByDisplayName: 'Alex',
        isClaimedByViewer: false
      }
    };
    for (const html of [rowHtml(purchase, true), rowHtml(ownItem, false)]) {
      expect(html).not.toContain('wish-row-bought');
      expect(html).not.toContain('wish-gift-label');
      expect(html).not.toContain('has bought this');
      expect(html).not.toContain('Mark as not bought');
    }
  });

  it('shows another giver’s status without any gift mutation controls', () => {
    const html = rowHtml(
      {
        ...ownItem,
        claimVisibility: 'visible',
        claim: {
          state: 'claimed',
          claimedByMemberId: 'giver',
          claimedByDisplayName: 'Alex',
          isClaimedByViewer: false
        }
      },
      false
    );
    expect(html).toContain('Alex is getting this');
    expect(html).not.toContain('value="claim-item"');
    expect(html).not.toContain('value="unclaim-item"');
    expect(html).not.toContain('value="mark-purchased"');
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
