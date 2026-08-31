const MAX_PRODUCT_URL_LENGTH = 2048;
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Normalise an optional product link before it is stored or rendered.
 * Only ordinary web links without embedded credentials are accepted.
 */
export function normaliseProductUrl(input: unknown): string | null {
  if (typeof input !== 'string') return null;

  const candidate = input.trim();
  if (candidate.length === 0 || candidate.length > MAX_PRODUCT_URL_LENGTH) return null;

  try {
    const url = new URL(candidate);

    if (!ALLOWED_PROTOCOLS.has(url.protocol)) return null;
    if (url.username || url.password) return null;

    return url.toString();
  } catch {
    return null;
  }
}
