import { describe, expect, it } from 'vitest';

import { normaliseProductImageUrl, normaliseProductUrl } from '../app/lib/product-url';

describe('normaliseProductUrl', () => {
  it.each([undefined, null, 42, '', '   ', 'not a url'])('rejects invalid input: %s', (input) => {
    expect(normaliseProductUrl(input)).toBeNull();
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///etc/passwd',
    'ftp://example.com/gift'
  ])('rejects a non-web protocol: %s', (input) => {
    expect(normaliseProductUrl(input)).toBeNull();
  });

  it('rejects URLs containing credentials', () => {
    expect(normaliseProductUrl('https://someone:secret@example.com/gift')).toBeNull();
  });

  it('rejects URLs longer than the storage boundary', () => {
    expect(normaliseProductUrl(`https://example.com/${'a'.repeat(2030)}`)).toBeNull();
  });

  it.each([
    ['https://example.com/gift', 'https://example.com/gift'],
    ['  https://example.com/gift?q=red  ', 'https://example.com/gift?q=red'],
    ['http://localhost:8787/item', 'http://localhost:8787/item']
  ])('normalises a valid product URL', (input, expected) => {
    expect(normaliseProductUrl(input)).toBe(expected);
  });
});

describe('normaliseProductImageUrl', () => {
  it('resolves a relative HTTPS image against its product page', () => {
    expect(
      normaliseProductImageUrl('/images/product.webp', 'https://shop.example/products/one')
    ).toBe('https://shop.example/images/product.webp');
  });

  it.each([
    'http://cdn.example/product.webp',
    'https://user:secret@cdn.example/product.webp',
    'https://localhost/product.webp',
    'https://127.0.0.1/product.webp',
    'https://10.0.0.4/product.webp',
    'https://[::1]/product.webp',
    'data:image/png;base64,abc'
  ])('rejects an unsafe automatically loaded image: %s', (input) => {
    expect(normaliseProductImageUrl(input)).toBeNull();
  });
});
