import { describe, expect, it, vi } from 'vitest';

import { fetchProductImage, productImagePath, ProductImageError } from '../app/lib/product-image';

describe('product image proxy', () => {
  it('builds a same-origin image path without exposing credentials', () => {
    expect(productImagePath('https://cdn.example/gift.jpg?size=large')).toBe(
      '/product-image?url=https%3A%2F%2Fcdn.example%2Fgift.jpg%3Fsize%3Dlarge'
    );
  });

  it('returns a bounded supported raster image without forwarding family headers', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { 'Content-Type': 'image/webp' }
      })
    );

    const response = await fetchProductImage('https://cdn.example/gift.webp', fetcher);

    expect(response.headers.get('Content-Type')).toBe('image/webp');
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=86400');
    await expect(response.arrayBuffer()).resolves.toHaveProperty('byteLength', 3);
    const [, init] = fetcher.mock.calls[0] ?? [];
    const headers = new Headers(init?.headers);
    expect(headers.has('Cookie')).toBe(false);
    expect(headers.has('Authorization')).toBe(false);
    expect(init?.redirect).toBe('manual');
  });

  it('revalidates redirects before fetching them', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(null, { status: 302, headers: { Location: 'https://127.0.0.1/private.png' } })
      );

    await expect(fetchProductImage('https://cdn.example/gift.png', fetcher)).rejects.toBeInstanceOf(
      ProductImageError
    );
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each(['image/svg+xml', 'text/html', 'application/octet-stream'])(
    'rejects an active or ambiguous response type: %s',
    async (contentType) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('<unsafe>', { headers: { 'Content-Type': contentType } }));

      await expect(fetchProductImage('https://cdn.example/gift', fetcher)).rejects.toBeInstanceOf(
        ProductImageError
      );
    }
  );

  it('rejects a streamed image above the proxy limit', async () => {
    const oversized = new Uint8Array(4 * 1024 * 1024 + 1);
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(oversized, { headers: { 'Content-Type': 'image/jpeg' } }));

    await expect(fetchProductImage('https://cdn.example/gift.jpg', fetcher)).rejects.toThrow(
      'too large'
    );
  });
});
