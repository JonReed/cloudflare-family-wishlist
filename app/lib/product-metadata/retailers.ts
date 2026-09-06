import { isRecord, cleanText } from './text';
import type { RetailerAdapter } from './types';
import { MAX_RETAILER_HTML_BYTES } from './transport';
import { firstEvidence } from './page-evidence';

function amazonAsin(url: URL): string {
  return (
    /\/(?:dp|gp\/product|gp\/aw\/d)\/([a-z0-9]{10})(?:[/?]|$)/i.exec(url.pathname)?.[1] ?? ''
  ).toUpperCase();
}

function largestAmazonDynamicImage(rawValue: string): string {
  if (!rawValue) return '';

  try {
    const value: unknown = JSON.parse(rawValue);
    if (!isRecord(value)) return '';

    let largestUrl = '';
    let largestArea = -1;
    for (const [url, dimensions] of Object.entries(value)) {
      if (!Array.isArray(dimensions)) continue;
      const width = typeof dimensions[0] === 'number' ? dimensions[0] : 0;
      const height = typeof dimensions[1] === 'number' ? dimensions[1] : 0;
      const area = width * height;
      if (area > largestArea) {
        largestUrl = url;
        largestArea = area;
      }
    }
    return largestUrl;
  } catch {
    return '';
  }
}

const AMAZON_UK_ADAPTER: RetailerAdapter = {
  matches(url) {
    const hostname = url.hostname.toLowerCase();
    return hostname === 'amazon.co.uk' || hostname.endsWith('.amazon.co.uk');
  },
  // Amazon can place the primary product block just beyond the general page
  // limit after large inline styles and scripts. Keep the fetch bounded, but
  // allow enough of known Amazon product pages to reach that block.
  htmlByteLimit: MAX_RETAILER_HTML_BYTES,
  cleanTitle(rawTitle) {
    const title = cleanText(rawTitle).replace(/\s*:\s*Amazon\.co\.uk(?::.*)?$/i, '');
    const firstClause = title.split(/\s*,\s*/, 1)[0] ?? '';
    return firstClause.length >= 12 ? firstClause : title;
  },
  titleCandidates(evidence) {
    return [
      firstEvidence(evidence, ['title-amazon-legacy']),
      firstEvidence(evidence, ['title-amazon-heading'])
    ];
  },
  priceCandidates(evidence) {
    const currency = firstEvidence(evidence, ['amazon-base-currency', 'amazon-data-currency']);
    return [
      { price: firstEvidence(evidence, ['amazon-base-display']), currency },
      { price: firstEvidence(evidence, ['amazon-base-amount']), currency },
      { price: firstEvidence(evidence, ['amazon-attach-base-price']), currency },
      { price: firstEvidence(evidence, ['amazon-data-price']), currency },
      { price: firstEvidence(evidence, ['price-to-pay']), currency },
      { price: firstEvidence(evidence, ['price-amazon-offscreen']), currency }
    ];
  },
  imageCandidates(evidence) {
    const dynamicImages = evidence.values.get('amazon-image-dynamic') ?? [];
    return [
      firstEvidence(evidence, ['amazon-image-old-hires']),
      ...dynamicImages.map(largestAmazonDynamicImage),
      firstEvidence(evidence, ['amazon-image-src'])
    ];
  },
  retryUrl(url) {
    const asin = amazonAsin(url);
    // Amazon currently challenges Cloudflare Worker egress on its desktop
    // product route while serving equivalent product evidence from this
    // lightweight mobile route. Use it only after detecting a real challenge.
    return asin ? new URL(`/gp/aw/d/${asin}`, url.origin) : url;
  },
  canonicalUrl(url) {
    const asin = amazonAsin(url);
    return asin ? new URL(`/dp/${asin}`, url.origin) : url;
  }
};

const RETAILER_ADAPTERS = [AMAZON_UK_ADAPTER] as const;

export function retailerAdapter(productUrl: string | URL): RetailerAdapter | null {
  const url = typeof productUrl === 'string' ? new URL(productUrl) : productUrl;
  return RETAILER_ADAPTERS.find((adapter) => adapter.matches(url)) ?? null;
}
