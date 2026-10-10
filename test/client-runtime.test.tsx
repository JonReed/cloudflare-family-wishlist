import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ClientRuntime } from '../app/components/client-runtime';

describe('client runtime', () => {
  it('loads only the nonce-protected picture fallback on public sharing pages', () => {
    const html = renderToStaticMarkup(<ClientRuntime cspNonce="test-nonce" isPublicShare={true} />);

    expect(html).toBe(
      '<script src="/shared-assets/product-pictures.js" nonce="test-nonce" defer=""></script>'
    );
    expect(html).not.toContain('/assets/');
  });
});
