import { describe, expect, it } from 'vitest';

import { sharedProductUrl } from '../app/lib/share-target';

function params(values: Partial<Record<'text' | 'url', string>>): URLSearchParams {
  const searchParams = new URLSearchParams();
  for (const [name, value] of Object.entries(values)) {
    if (value) searchParams.set(name, value);
  }
  return searchParams;
}

describe('Android web share target', () => {
  it('prefers a dedicated shared URL', () => {
    expect(
      sharedProductUrl(
        params({
          text: 'A description with https://wrong.example/item',
          url: 'https://shop.example/products/cosy-socks?colour=green'
        })
      )
    ).toBe('https://shop.example/products/cosy-socks?colour=green');
  });

  it('extracts the URL Android places inside shared text', () => {
    expect(
      sharedProductUrl(
        params({ text: 'Cosy socks from Example Shop https://shop.example/products/socks.' })
      )
    ).toBe('https://shop.example/products/socks');
  });

  it.each([
    {},
    { text: 'A product without a link' },
    { text: 'javascript:alert(1)' },
    { url: 'https://person:secret@shop.example/item' },
    { text: 'Look at https://person:secret@shop.example/item' }
  ])('rejects missing or unsafe shared data: %o', (values) => {
    expect(sharedProductUrl(params(values))).toBeNull();
  });
});
