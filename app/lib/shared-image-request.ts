import { fetchProductImage, ProductImageError } from './product-image';
import { normaliseProductImageUrl } from './product-url';

const IMAGE_CACHE_SECONDS = 86_400;

export function sharedImageHeadResponse(method: string): Response | null {
  if (method !== 'HEAD') return null;
  return new Response(null, {
    status: 200,
    headers: { 'Content-Type': 'application/octet-stream' }
  });
}

/** The caller must check the active sharing link, enabled owner and item scope first. */
export async function fetchSharedImage(
  request: Request,
  imageUrl: string,
  ctx: ExecutionContext,
  consumeBudget: () => Promise<void>
): Promise<Response> {
  const safeUrl = normaliseProductImageUrl(imageUrl);
  if (!safeUrl) throw new ProductImageError('That picture address is not safe to load.');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(safeUrl));
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
  // Revisit the shop at least once each UTC day, even when its picture URL stays unchanged.
  const day = Math.floor(Date.now() / (IMAGE_CACHE_SECONDS * 1000));
  const etag = `W/"${hash}.${day}"`;
  const headers = new Headers({
    'Cache-Control': 'private, no-cache',
    ETag: etag,
    'X-Shared-Image-Proxy': '1'
  });
  const matches = request.headers
    .get('If-None-Match')
    ?.split(',')
    .some((value) => {
      const tag = value.trim();
      return tag === '*' || tag.replace(/^W\//, '') === etag.slice(2);
    });
  if (matches) return new Response(null, { status: 304, headers });

  // Keep cache keys on the public bypass path and omit sharing codes, cookies and shop URLs.
  const cacheKey = new Request(new URL(`/shared/__image-cache/v1/${hash}.${day}`, request.url));
  let cache: Cache | null = null;
  let cached: Response | undefined;
  try {
    cache = await caches.open('wishlist-shared-images-v1');
    cached = await cache.match(cacheKey);
  } catch {
    console.warn(JSON.stringify({ event: 'shared_image_cache_read_failed' }));
  }
  if (!cached) await consumeBudget();
  const response = cached ?? (await fetchProductImage(safeUrl));
  headers.set('Cache-Status', `FamilyWishlist; ${cached ? 'hit' : 'fwd=uri-miss'}`);
  if (!cached && cache) {
    const stored = response.clone();
    stored.headers.set('Cache-Control', `public, max-age=${IMAGE_CACHE_SECONDS}`);
    ctx.waitUntil(
      cache.put(cacheKey, stored).catch(() => {
        console.warn(JSON.stringify({ event: 'shared_image_cache_write_failed' }));
      })
    );
  }
  for (const name of ['Content-Type', 'Content-Length']) {
    const value = response.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(response.body, { headers });
}
