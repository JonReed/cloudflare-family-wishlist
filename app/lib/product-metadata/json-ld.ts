import { cleanText, valueAsString, isRecord, parseAttributes } from './text';
import type { PriceCandidate, JsonLdProduct } from './types';

function addUniqueValue(values: string[], rawValue: unknown): void {
  const value = cleanText(valueAsString(rawValue));
  if (value && !values.includes(value)) values.push(value);
}

function collectJsonLdImages(rawImage: unknown, images: string[], depth = 0): void {
  if (depth > 4) return;

  if (Array.isArray(rawImage)) {
    for (const image of rawImage) collectJsonLdImages(image, images, depth + 1);
    return;
  }

  if (isRecord(rawImage)) {
    for (const field of ['contentUrl', 'url', 'image', 'thumbnailUrl']) {
      collectJsonLdImages(rawImage[field], images, depth + 1);
    }
    return;
  }

  addUniqueValue(images, rawImage);
}

function schemaTypes(value: Record<string, unknown>): string[] {
  const rawType = value['@type'];
  return (Array.isArray(rawType) ? rawType : [rawType])
    .filter((entry): entry is string => typeof entry === 'string')
    .map((entry) => entry.toLowerCase());
}

function addPriceCandidate(
  prices: PriceCandidate[],
  rawPrice: unknown,
  rawCurrency: unknown
): void {
  const price = valueAsString(rawPrice);
  if (!price) return;

  const candidate = { price, currency: valueAsString(rawCurrency) };
  if (
    !prices.some(
      (existing) => existing.price === candidate.price && existing.currency === candidate.currency
    )
  ) {
    prices.push(candidate);
  }
}

function collectOfferPrices(
  rawOffers: unknown,
  prices: PriceCandidate[],
  fallbackCurrency: string
): void {
  const offers = Array.isArray(rawOffers) ? rawOffers : [rawOffers];

  for (const rawOffer of offers) {
    if (!isRecord(rawOffer)) continue;

    const currency = valueAsString(rawOffer.priceCurrency) || fallbackCurrency;
    addPriceCandidate(prices, rawOffer.price, currency);

    const specifications = Array.isArray(rawOffer.priceSpecification)
      ? rawOffer.priceSpecification
      : [rawOffer.priceSpecification];
    for (const specification of specifications) {
      if (!isRecord(specification)) continue;
      addPriceCandidate(
        prices,
        specification.price,
        valueAsString(specification.priceCurrency) || currency
      );
    }

    addPriceCandidate(prices, rawOffer.lowPrice, currency);
    addPriceCandidate(prices, rawOffer.highPrice, currency);
  }
}

function collectJsonLdEvidence(
  value: unknown,
  evidence: JsonLdProduct,
  depth = 0,
  selected?: unknown
): void {
  if (depth > 8) return;

  if (Array.isArray(value)) {
    for (const entry of value) collectJsonLdEvidence(entry, evidence, depth + 1, selected);
    return;
  }

  if (!isRecord(value)) return;

  const types = schemaTypes(value);
  if (types.includes('product') && value === selected) {
    addUniqueValue(evidence.titles, value.name);
    collectJsonLdImages(value.image, evidence.images);
    const currency = valueAsString(value.priceCurrency);
    addPriceCandidate(evidence.prices, value.price, currency);
    collectOfferPrices(value.offers, evidence.prices, currency);
  }

  if (types.includes('breadcrumblist') && Array.isArray(value.itemListElement)) {
    const breadcrumbItems: unknown[] = value.itemListElement;
    const lastItem: unknown = breadcrumbItems.at(-1);
    if (isRecord(lastItem)) {
      const nestedItem = isRecord(lastItem.item) ? lastItem.item : null;
      addUniqueValue(evidence.breadcrumbTitles, lastItem.name || nestedItem?.name);
    }
  }

  for (const entry of Object.values(value))
    collectJsonLdEvidence(entry, evidence, depth + 1, selected);
}

export function extractJsonLdProduct(html: string, productUrl: string): JsonLdProduct {
  const evidence: JsonLdProduct = { titles: [], breadcrumbTitles: [], prices: [], images: [] };
  const roots: unknown[] = [];

  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)) {
    const attributes = parseAttributes(match[1] ?? '');
    if (attributes.get('type')?.toLowerCase() !== 'application/ld+json') continue;

    try {
      roots.push(JSON.parse(match[2] ?? ''));
    } catch {
      // Invalid structured data should not prevent the ordinary meta tags from being used.
    }
  }

  const products: Record<string, unknown>[] = [];
  const mainEntities: unknown[] = [];
  const visit = (value: unknown, depth = 0): void => {
    if (depth > 8) return;
    if (Array.isArray(value)) {
      value.forEach((entry) => visit(entry, depth + 1));
      return;
    }
    if (!isRecord(value)) return;
    if (schemaTypes(value).includes('product')) products.push(value);
    if (schemaTypes(value).some((type) => type === 'webpage' || type === 'itempage')) {
      const entities: unknown[] = Array.isArray(value.mainEntity)
        ? value.mainEntity
        : [value.mainEntity];
      mainEntities.push(...entities);
    }
    Object.values(value).forEach((entry) => visit(entry, depth + 1));
  };
  roots.forEach((root) => visit(root));
  const matchesPage = (value: unknown, ignoreQuery = false): boolean => {
    const address = isRecord(value) ? value['@id'] : value;
    if (typeof address !== 'string') return false;
    try {
      const candidate = new URL(address, productUrl);
      const page = new URL(productUrl);
      return (
        candidate.origin === page.origin &&
        candidate.pathname.replace(/\/$/, '') === page.pathname.replace(/\/$/, '') &&
        (ignoreQuery || candidate.search === page.search)
      );
    } catch {
      return false;
    }
  };
  const score = (product: Record<string, unknown>): number => {
    if (matchesPage(product.url)) return 6;
    if (
      mainEntities.some(
        (entry) =>
          entry === product ||
          (isRecord(entry) && typeof entry['@id'] === 'string' && entry['@id'] === product['@id'])
      )
    )
      return 5;
    if (matchesPage(product.mainEntityOfPage)) return 4;
    if (matchesPage(product['@id'])) return 3;
    // Tracking parameters often appear only on the incoming link. Exact matches
    // win first so a selected variant's query string still takes precedence.
    if (matchesPage(product.url, true)) return 2;
    if (matchesPage(product.mainEntityOfPage, true) || matchesPage(product['@id'], true)) return 1;
    return 0;
  };
  const selected = products.reduce<Record<string, unknown> | undefined>(
    (best, product) => (!best || score(product) > score(best) ? product : best),
    undefined
  );
  for (const root of roots) collectJsonLdEvidence(root, evidence, 0, selected);
  return evidence;
}
