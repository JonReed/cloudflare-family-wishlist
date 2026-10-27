import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { SharedWishlistItem } from '../app/lib/db/shared-wishlists';
import SharedWishlistPage from '../app/routes/shared-wishlist';

describe('shared wishlist reservation presentation', () => {
  it.each(['available', 'reserved', 'yours', 'bought'] as const)(
    'marks reserved and bought rows using only the guest-visible state: %s',
    (reservation: SharedWishlistItem['reservation']) => {
      const token = 'a'.repeat(22);
      const loaderData = {
        wishlists: [
          {
            id: 'list-1',
            ownerDisplayName: 'Sam',
            items: [
              {
                id: 'wish-1',
                title: 'A good book',
                notes: 'The illustrated edition',
                productUrl: 'https://example.com/book',
                imageUrl: null,
                priceAmountMinor: 1500,
                priceCurrency: 'GBP',
                priority: 'normal' as const,
                reservation
              }
            ]
          }
        ],
        token,
        recoveryCode: null
      };
      const html = renderToStaticMarkup(
        <SharedWishlistPage
          loaderData={loaderData}
          params={{ token }}
          matches={[
            {
              id: 'root',
              params: {},
              pathname: '/',
              loaderData: { cspNonce: 'test', isPublicShare: true },
              handle: undefined
            },
            {
              id: 'routes/shared-wishlist',
              params: { token },
              pathname: `/shared/${token}`,
              loaderData,
              handle: undefined
            }
          ]}
        />
      );

      expect(html).toContain('A good book');
      expect(html).not.toContain('aria-label="Shared wishlists"');
      expect(html).toContain('<h3 id="wish-title-wish-1">A good book</h3>');
      expect(html).toContain('<summary aria-controls="wish-title-wish-1">');
      expect(html).toContain('<details class="wish-title-toggle" hidden="">');
      expect(html).toContain('The illustrated edition');
      expect(html).toContain('href="https://example.com/book" target="_blank" rel="noreferrer"');
      if (reservation === 'bought') {
        expect(html).toContain('class="wish-row shared-wish-row wish-row-normal wish-row-bought"');
        expect(html).toContain(
          '<span class="wish-gift-label"><span aria-hidden="true">✓</span> Bought</span>'
        );
        expect(html).not.toContain('wish-row-reserved');
        expect(html).toContain('You’ve bought this');
        expect(html).toContain('method="post"');
        expect(html).toContain('value="unbought"');
        expect(html).toContain('Mark as not bought');
      } else {
        expect(html).not.toContain('wish-row-bought');
        expect(html).not.toContain('You’ve bought this');
        if (reservation === 'available') {
          expect(html).not.toContain('wish-row-reserved');
          expect(html).not.toContain('wish-gift-label');
          expect(html).toContain('Available to give');
          expect(html).toContain('I’ll get this');
        } else {
          expect(html).toContain(
            'class="wish-row shared-wish-row wish-row-normal wish-row-reserved"'
          );
          expect(html).toContain(
            '<span class="wish-gift-label"><span aria-hidden="true">✓</span> Reserved</span>'
          );
          expect(html).not.toContain('I’ll get this');
        }
      }
      if (reservation === 'reserved') {
        expect(html).not.toContain('value="bought"');
        expect(html).not.toContain('value="unbought"');
        expect(html).not.toContain('value="release"');
      }
      if (reservation === 'yours') {
        expect(html).toContain('You’re getting this');
        expect(html).toContain('value="bought"');
        expect(html).toContain('value="release"');
      }
    }
  );
});
