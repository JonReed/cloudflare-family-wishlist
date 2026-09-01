import { normaliseProductImageUrl } from './product-url';

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_REDIRECTS = 4;
const FETCH_TIMEOUT_MS = 8_000;
const ALLOWED_IMAGE_TYPES = new Set([
  'image/avif',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/webp'
]);

export class ProductImageError extends Error {}

export function productImagePath(imageUrl: string): string {
  const path = new URL('/product-image', 'https://wishlist.invalid');
  path.searchParams.set('url', imageUrl);
  return `${path.pathname}${path.search}`;
}

async function readBoundedImage(response: Response): Promise<ArrayBuffer> {
  const declaredLength = response.headers.get('Content-Length');
  if (declaredLength) {
    const bytes = Number(declaredLength);
    if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > MAX_IMAGE_BYTES) {
      await response.body?.cancel();
      throw new ProductImageError('That picture is too large to display safely.');
    }
  }

  if (!response.body) throw new ProductImageError('That picture did not contain any image data.');

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    totalBytes += value.byteLength;
    if (totalBytes > MAX_IMAGE_BYTES) {
      await reader.cancel();
      throw new ProductImageError('That picture is too large to display safely.');
    }
    chunks.push(value);
  }

  const body = new Uint8Array(new ArrayBuffer(totalBytes));
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body.buffer;
}

export async function fetchProductImage(
  input: unknown,
  fetcher: typeof fetch = fetch
): Promise<Response> {
  const initialImageUrl = normaliseProductImageUrl(input);
  if (!initialImageUrl) throw new ProductImageError('That picture address is not safe to load.');
  let imageUrl: string = initialImageUrl;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
      let response: Response;
      try {
        response = await fetcher(imageUrl, {
          method: 'GET',
          redirect: 'manual',
          headers: {
            Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.8',
            'User-Agent': 'Cloudflare Family Wishlist image proxy'
          },
          signal: controller.signal
        });
      } catch {
        throw new ProductImageError('That picture could not be loaded safely.');
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('Location');
        await response.body?.cancel();
        const redirectedUrl: string | null = location
          ? normaliseProductImageUrl(location, imageUrl)
          : null;
        if (!redirectedUrl || redirectCount === MAX_REDIRECTS) {
          throw new ProductImageError('That picture redirected somewhere unsafe.');
        }
        imageUrl = redirectedUrl;
        continue;
      }

      const contentType = response.headers
        .get('Content-Type')
        ?.split(';', 1)[0]
        ?.trim()
        .toLowerCase();
      if (!response.ok || !contentType || !ALLOWED_IMAGE_TYPES.has(contentType)) {
        await response.body?.cancel();
        throw new ProductImageError('That address did not return a supported picture.');
      }

      const body = await readBoundedImage(response);
      return new Response(body, {
        headers: {
          'Cache-Control': 'private, max-age=86400',
          'Content-Length': String(body.byteLength),
          'Content-Type': contentType,
          'X-Product-Image-Proxy': '1'
        }
      });
    }
  } finally {
    clearTimeout(timeout);
  }

  throw new ProductImageError('That picture could not be loaded safely.');
}
