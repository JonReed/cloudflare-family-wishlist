import { describe, expect, it } from 'vitest';

import { fillMissingProductDraft } from '../app/lib/product-draft';

const product = {
  productUrl: 'https://shop.example/products/warm-scarf',
  title: 'Warm wool scarf',
  price: '32.00',
  imageUrl: 'https://cdn.example/warm-scarf.webp',
  aiAssisted: false
};

describe('add-from-anywhere product drafts', () => {
  it('fills an empty picture field along with the other product details', () => {
    expect(
      fillMissingProductDraft(
        {
          productUrl: product.productUrl,
          title: '',
          price: '',
          imageUrl: '',
          aiAssisted: false,
          notes: 'The green one',
          priority: 'high' as const
        },
        product
      )
    ).toEqual({
      ...product,
      notes: 'The green one',
      priority: 'high'
    });
  });

  it('does not replace details the person already edited', () => {
    expect(
      fillMissingProductDraft(
        {
          productUrl: product.productUrl,
          title: 'The scarf from the window',
          price: '30',
          imageUrl: 'https://images.example/chosen-scarf.jpg',
          aiAssisted: false
        },
        product
      )
    ).toMatchObject({
      title: 'The scarf from the window',
      price: '30',
      imageUrl: 'https://images.example/chosen-scarf.jpg'
    });
  });
});
