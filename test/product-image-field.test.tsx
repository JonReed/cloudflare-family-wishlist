import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ProductImageField } from '../app/components/product-image-field';

describe('product image field', () => {
  it('leads with a thumbnail and human-facing controls when a picture exists', () => {
    const html = renderToStaticMarkup(
      <ProductImageField
        formId="new-wish"
        defaultValue="https://cdn.example.com/products/scarf.webp"
      />
    );

    expect(html).toContain('Here’s the picture we’ll use');
    expect(html).toContain('Change picture');
    expect(html).toContain('Remove picture');
    expect(html).toContain('src="https://cdn.example.com/products/scarf.webp"');
    expect(html).toContain('name="imageUrl"');
  });

  it('shows a friendly optional empty state without exposing the address field', () => {
    const html = renderToStaticMarkup(<ProductImageField formId="new-wish" />);

    expect(html).toContain('No picture yet');
    expect(html).toContain('Add a picture');
    expect(html).toContain('<details class="product-image-editor">');
    expect(html).toContain('data-product-image-remove="" hidden=""');
  });
});
