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

export class RasterImageError extends Error {}

async function readBoundedImage(response: Response): Promise<ArrayBuffer> {
  const declaredLength = response.headers.get('Content-Length');
  if (declaredLength) {
    const bytes = Number(declaredLength);
    if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > MAX_IMAGE_BYTES) {
      await response.body?.cancel();
      throw new RasterImageError('That picture is too large to display safely.');
    }
  }

  if (!response.body) throw new RasterImageError('That picture did not contain any image data.');

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
      throw new RasterImageError('That picture is too large to display safely.');
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

export async function fetchRasterImage(
  input: unknown,
  fetcher: typeof fetch = fetch
): Promise<Response> {
  const initialImageUrl = normaliseProductImageUrl(input);
  if (!initialImageUrl) throw new RasterImageError('That picture address is not safe to load.');
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
            'User-Agent': 'Cloudflare Family Wishlist avatar fetch'
          },
          signal: controller.signal
        });
      } catch {
        throw new RasterImageError('That picture could not be loaded safely.');
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('Location');
        await response.body?.cancel();
        const redirectedUrl: string | null = location
          ? normaliseProductImageUrl(location, imageUrl)
          : null;
        if (!redirectedUrl || redirectCount === MAX_REDIRECTS) {
          throw new RasterImageError('That picture redirected somewhere unsafe.');
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
        throw new RasterImageError('That address did not return a supported picture.');
      }

      const body = await readBoundedImage(response);
      return new Response(body, {
        headers: {
          'Cache-Control': 'private, no-store',
          'Content-Length': String(body.byteLength),
          'Content-Type': contentType
        }
      });
    }
  } finally {
    clearTimeout(timeout);
  }

  throw new RasterImageError('That picture could not be loaded safely.');
}
