import type { ProductDiagnostics as Diagnostics } from '../lib/product-metadata';

export function ProductDiagnostics({ diagnostics }: { diagnostics?: Diagnostics }) {
  return (
    <details className="product-diagnostics" data-product-diagnostics hidden={!diagnostics}>
      <summary>Technical details</summary>
      <pre data-product-diagnostics-text>
        {diagnostics ? [diagnostics.hostname, ...diagnostics.steps].join('\n') : ''}
      </pre>
      <button type="button" className="text-link" data-product-diagnostics-copy hidden>
        Copy diagnostics
      </button>
      <span role="status" data-product-diagnostics-copy-status />
    </details>
  );
}
