import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ClientRuntime } from '../app/components/client-runtime';

describe('client runtime', () => {
  it('keeps public sharing pages script-free', () => {
    const html = renderToStaticMarkup(<ClientRuntime cspNonce="test-nonce" isPublicShare={true} />);

    expect(html).toBe('');
  });
});
