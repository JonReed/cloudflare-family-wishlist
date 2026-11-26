import { renderToStaticMarkup } from 'react-dom/server';
import { createRoutesStub } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { ItemFields } from '../app/components/wishlist/item-fields';
import { WishlistItemRow } from '../app/components/wishlist/item-row';
import { productFormDraft, submittedWishDraft } from '../app/lib/wishlist-form-draft';
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

function rowHtml(
  item: WishlistItem,
  isOwn = true,
  wasJustEdited = false,
  eligibleBuyers: FamilyWishlist['owner'][] = [],
  initialEditDraft?: ReturnType<typeof submittedWishDraft>
) {
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
            eligibleBuyers={eligibleBuyers}
            wasJustEdited={wasJustEdited}
            initialEditDraft={initialEditDraft}
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
    expect(html).toMatch(/<summary>Edit this wish <svg [^>]*aria-hidden="true"/);
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
    expect(html).toMatch(
      /class="priority priority-high"><svg [^>]*aria-hidden="true"[^>]*>.*?<\/svg> Top wish<\/span>/
    );
    expect(html).toContain('value="claim-item"');
    expect(html).toContain('I’ll get this');
    expect(html.indexOf('class="wish-footer"')).toBeLessThan(html.indexOf('value="claim-item"'));
  });

  it('keeps the lower priority label text-only', () => {
    expect(rowHtml({ ...ownItem, priority: 'low' })).toContain(
      '<span class="priority priority-low">Nice to have</span>'
    );
  });

  it('offers assignment only for a visible guest reservation with eligible buyers', () => {
    const guestItem: WishlistItem = {
      ...ownItem,
      claimVisibility: 'visible',
      claim: {
        state: 'purchased',
        claimedByMemberId: null,
        claimedByDisplayName: 'Guest link',
        isClaimedByViewer: false,
        guestReservedAt: '2026-10-01T12:00:00.000Z'
      }
    };
    const buyers = [{ id: 'alex', displayName: 'Alex' }];
    const html = rowHtml(guestItem, false, false, buyers);
    expect(html).toContain(
      'Guest link has bought this</p><details class="guest-reservation-dialog"><summary class="button-text">Manage reservation</summary>'
    );
    expect(html.indexOf('Manage reservation')).toBeLessThan(html.indexOf('class="wish-footer"'));
    expect(html).toContain('value="release-guest"');
    expect(html).toContain('<option value="alex">Alex</option>');
    expect(html).toContain('value="assign-guest"');
    expect(rowHtml(guestItem, false)).not.toContain('assign-guest');
    expect(rowHtml(guestItem, false)).toContain('Manage reservation');
    expect(rowHtml(guestItem, true, false, buyers)).not.toContain('Manage reservation');
    expect(rowHtml(guestItem, true, false, buyers)).not.toContain('assign-guest');
    expect(
      rowHtml(
        { ...guestItem, claim: { ...guestItem.claim!, claimedByMemberId: 'alex' } },
        false,
        false,
        buyers
      )
    ).not.toContain('assign-guest');
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
        expect(html).toMatch(
          /<span class="wish-gift-label"><svg [^>]*aria-hidden="true"[^>]*>.*?<\/svg> Bought<\/span>/
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

  it('reopens a rejected native edit with the submitted fields while showing the saved wish', () => {
    const form = new FormData();
    form.set('title', 'Edited title');
    form.set('notes', 'New notes');
    const html = rowHtml(ownItem, true, false, [], submittedWishDraft(form));
    expect(html).toMatch(/<details[^>]*open=""[^>]*class="wish-more"/);
    expect(html).toMatch(/<details[^>]*open=""[^>]*class="edit-panel"/);
    expect(html).toContain('value="Edited title"');
    expect(html).toContain('New notes</textarea>');
    expect(html).toContain('A good book</h3>');
  });

  it('retains editable fields after a rejected submission and bounds the returned draft', () => {
    const form = new FormData();
    form.set('productUrl', 'ftp://shop.example/gift');
    form.set('title', 'My wish');
    form.set('notes', 'a'.repeat(2100));
    form.set('price', '12.40');
    form.set('imageUrl', 'https://shop.example/photo');
    form.set('priority', 'low');
    expect(submittedWishDraft(form)).toEqual({
      productUrl: 'ftp://shop.example/gift',
      title: 'My wish',
      notes: 'a'.repeat(2000),
      price: '12.40',
      imageUrl: 'https://shop.example/photo',
      priority: 'low',
      aiAssisted: false
    });
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
