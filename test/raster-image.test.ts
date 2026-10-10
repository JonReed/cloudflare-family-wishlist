import { describe, expect, it, vi } from 'vitest';

import { fetchRasterImage, RasterImageError } from '../app/lib/raster-image';

describe('bounded avatar image fetching', () => {
  it('returns a bounded supported raster image without forwarding family headers', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { 'Content-Type': 'image/webp' }
      })
    );

    const response = await fetchRasterImage('https://cdn.example/gift.webp', fetcher);

    expect(response.headers.get('Content-Type')).toBe('image/webp');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
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

    await expect(fetchRasterImage('https://cdn.example/gift.png', fetcher)).rejects.toBeInstanceOf(
      RasterImageError
    );
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it.each(['image/svg+xml', 'text/html', 'application/octet-stream'])(
    'rejects an active or ambiguous response type: %s',
    async (contentType) => {
      const fetcher = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('<unsafe>', { headers: { 'Content-Type': contentType } }));

      await expect(fetchRasterImage('https://cdn.example/gift', fetcher)).rejects.toBeInstanceOf(
        RasterImageError
      );
    }
  );

  it('rejects a streamed image above the proxy limit', async () => {
    const oversized = new Uint8Array(4 * 1024 * 1024 + 1);
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(oversized, { headers: { 'Content-Type': 'image/jpeg' } }));

    await expect(fetchRasterImage('https://cdn.example/gift.jpg', fetcher)).rejects.toThrow(
      'too large'
    );
  });
});
