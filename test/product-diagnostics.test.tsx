import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ProductDiagnostics } from '../app/components/product-diagnostics';

describe('product diagnostics', () => {
  it('renders a collapsed native disclosure with escaped, selectable details', () => {
    const html = renderToStaticMarkup(
      <ProductDiagnostics
        diagnostics={{
          hostname: 'shop.example',
          steps: ['Direct fetch: HTTP 403', '<script>not markup</script>']
        }}
      />
    );
    expect(html).toContain('<summary>Technical details</summary>');
    expect(html).not.toContain(' open');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('data-product-diagnostics-copy="true" hidden=""');
  });
  it('hides the entire disclosure when no failure diagnostics exist', () => {
    const html = renderToStaticMarkup(<ProductDiagnostics />);
    expect(html).toContain('data-product-diagnostics="true" hidden=""');
  });
});
