import type { PriceCandidate, PageEvidence, ExtractedMetadata } from './types';
import { normalisePrice, cleanText } from './text';
import { normaliseProductImageUrl } from '../product-url';
import { retailerAdapter } from './retailers';
import { extractPageEvidence, firstEvidence } from './page-evidence';
import { extractJsonLdProduct } from './json-ld';

function firstMetaValue(values: Map<string, string>, keys: string[]): string {
  for (const key of keys) {
    const value = values.get(key);
    if (value) return value;
  }
  return '';
}

function labelledTwitterPrice(values: Map<string, string>): string {
  for (const position of ['1', '2']) {
    const label = values.get(`twitter:label${position}`) ?? '';
    const data = values.get(`twitter:data${position}`) ?? '';
    if (/\bprice\b/i.test(label) && data) return data;
  }
  return '';
}

function firstValidPrice(candidates: PriceCandidate[]): string {
  for (const candidate of candidates) {
    const price = normalisePrice(candidate.price, candidate.currency);
    if (price) return price;
  }
  return '';
}

function firstValidImageUrl(candidates: string[], productUrl: string): string {
  const productHostname = new URL(productUrl).hostname.toLowerCase();

  for (const candidate of candidates) {
    const retailerCandidate =
      productHostname === 'rh.com' || productHostname.endsWith('.rh.com')
        ? candidate.replace('$GAL4$', '$np-fullwidth-lg$')
        : candidate;
    const imageUrl = normaliseProductImageUrl(retailerCandidate, productUrl);
    if (imageUrl) return imageUrl;
  }
  return '';
}

function cleanFallbackTitle(rawTitle: string, evidence: PageEvidence, productUrl: string): string {
  const title = cleanText(rawTitle);
  const adapter = retailerAdapter(productUrl);
  if (adapter) return adapter.cleanTitle(title);

  const siteName = evidence.meta.get('og:site_name') ?? '';
  if (!siteName) return title;

  const comparableSiteName = cleanText(siteName).toLocaleLowerCase('en-GB');
  for (const separator of [' | ', ' – ', ' — ', ' : ']) {
    const parts = title.split(separator);
    if (parts.length < 2) continue;
    const siteIndex = parts.findIndex(
      (part, index) =>
        index > 0 && cleanText(part).toLocaleLowerCase('en-GB').includes(comparableSiteName)
    );
    if (siteIndex > 0) return parts.slice(0, siteIndex).join(separator);
  }

  return title;
}

export async function extractMetadata(
  html: string,
  productUrl: string
): Promise<ExtractedMetadata> {
  const evidence = await extractPageEvidence(html);
  const jsonLd = extractJsonLdProduct(html, productUrl);
  const metaTitle = firstMetaValue(evidence.meta, ['og:title', 'twitter:title', 'name', 'title']);
  const adapter = retailerAdapter(productUrl);
  const adapterTitle = adapter?.titleCandidates(evidence).find(Boolean) ?? '';
  const elementTitle = firstEvidence(evidence, [
    'title-product',
    'title-product-name',
    'title-item-name',
    'product-microdata-name',
    'product-microdata-name-text',
    'microdata-name',
    'microdata-name-text'
  ]);
  const reliableTitle =
    jsonLd.titles[0] ||
    metaTitle ||
    adapterTitle ||
    elementTitle ||
    jsonLd.breadcrumbTitles[0] ||
    '';
  const documentTitle = firstEvidence(evidence, ['document-title']);
  const rawTitle = reliableTitle || documentTitle;
  const title = (
    adapter ? adapter.cleanTitle(rawTitle) : cleanFallbackTitle(rawTitle, evidence, productUrl)
  ).slice(0, 160);

  const metaCurrency = firstMetaValue(evidence.meta, [
    'product:price:currency',
    'og:price:currency',
    'product.price.currency',
    'pricecurrency'
  ]);
  const standardCandidates: PriceCandidate[] = [
    {
      price: firstMetaValue(evidence.meta, [
        'product:price:amount',
        'og:price:amount',
        'product.price.amount',
        'price'
      ]),
      currency: metaCurrency
    },
    { price: labelledTwitterPrice(evidence.meta), currency: metaCurrency },
    ...jsonLd.prices,
    {
      price: firstEvidence(evidence, ['product-microdata-price', 'product-microdata-price-text']),
      currency: firstEvidence(evidence, ['product-microdata-currency']) || metaCurrency
    },
    {
      price: firstEvidence(evidence, ['microdata-price', 'microdata-price-text']),
      currency: firstEvidence(evidence, ['microdata-currency']) || metaCurrency
    },
    {
      price: firstEvidence(evidence, ['price-visible']),
      currency: metaCurrency
    }
  ];
  const price = firstValidPrice([
    ...(adapter?.priceCandidates(evidence) ?? []),
    ...standardCandidates
  ]);
  const imageUrl = firstValidImageUrl(
    [
      ...(adapter?.imageCandidates(evidence) ?? []),
      ...['og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src'].map(
        (key) => evidence.meta.get(key) ?? ''
      ),
      ...jsonLd.images,
      firstEvidence(evidence, ['product-microdata-image', 'microdata-image']),
      firstMetaValue(evidence.meta, ['image'])
    ],
    productUrl
  );

  return {
    productUrl,
    title,
    price,
    imageUrl,
    aiAssisted: false,
    titleIsReliable: Boolean(reliableTitle),
    challengeDetected: evidence.challengeDetected
  };
}
