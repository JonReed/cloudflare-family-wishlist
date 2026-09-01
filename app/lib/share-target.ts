import { normaliseProductUrl } from './product-url';

const MAX_SHARED_TEXT_LENGTH = 8192;
const SHARED_URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;
const TRAILING_SENTENCE_PUNCTUATION = /[\])}>,.;!?]+$/;

function validProductUrl(value: string | null): string | null {
  return normaliseProductUrl(value);
}

/** Extracts a safe product URL from browser or Android share-target parameters. */
export function sharedProductUrl(searchParams: URLSearchParams): string | null {
  const directUrl = validProductUrl(searchParams.get('url'));
  if (directUrl) return directUrl;

  const sharedText = searchParams.get('text')?.slice(0, MAX_SHARED_TEXT_LENGTH) ?? '';
  const exactTextUrl = validProductUrl(sharedText);
  if (exactTextUrl) return exactTextUrl;

  for (const match of sharedText.matchAll(SHARED_URL_PATTERN)) {
    const candidate = match[0].replace(TRAILING_SENTENCE_PUNCTUATION, '');
    const productUrl = validProductUrl(candidate);
    if (productUrl) return productUrl;
  }

  return null;
}
