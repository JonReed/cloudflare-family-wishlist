import { decodeHtmlEntities, parseAttributes, cleanText } from './text';
import type { ProductAiImageCandidate, PreparedAiEvidence } from './types';
import { normaliseProductImageUrl } from '../product-url';

const MAX_AI_PAGE_CHARACTERS = 10_000;

const MAX_AI_IMAGE_CANDIDATES = 8;

const MAX_AI_IMAGE_URL_CHARACTERS = 500;

const AI_REMOVAL_SELECTORS = [
  'script',
  'style',
  'noscript',
  'svg',
  'canvas',
  'template',
  'iframe',
  'nav',
  'header',
  'footer',
  'form',
  'button',
  'input',
  'select',
  'textarea',
  'dialog',
  '[hidden]',
  '[aria-hidden="true"]',
  '[role="navigation"]',
  '[role="banner"]',
  '[role="contentinfo"]',
  '[role="dialog"]',
  '[class*="breadcrumb"]',
  '[id*="breadcrumb"]',
  '[class*="cookie"]',
  '[id*="cookie"]',
  '[class*="consent"]',
  '[id*="consent"]',
  '[class*="newsletter"]',
  '[id*="newsletter"]',
  '[class*="recommend"]',
  '[id*="recommend"]',
  '[class*="related"]',
  '[id*="related"]',
  '[class*="recently"]',
  '[id*="recently"]',
  '[class*="review"]',
  '[id*="review"]',
  '[class*="rating"]',
  '[id*="rating"]',
  '[class*="advert"]',
  '[id*="advert"]',
  '[class*="social"]',
  '[id*="social"]',
  '[class*="share"]',
  '[id*="share"]',
  '[class*="site-header"]',
  '[id*="site-header"]',
  '[class*="site-footer"]',
  '[id*="site-footer"]'
] as const;

const BOILERPLATE_LINE =
  /^(?:accept|reject|manage) (?:all )?cookies|^(?:sign|log) in$|^(?:my )?(?:bag|basket|cart|account)$|^skip to (?:content|main)|^(?:privacy|cookie) policy$|^terms (?:and conditions|of use)$/i;

function textLinesFromHtml(html: string): string[] {
  const withBreaks = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(?:br|hr)\b[^>]*>/gi, '\n')
    .replace(
      /<\/(?:address|article|aside|blockquote|dd|div|dl|dt|figcaption|figure|h[1-6]|li|main|p|section|table|td|th|tr)>/gi,
      '\n'
    )
    .replace(/<[^>]+>/g, ' ');

  const lines: string[] = [];
  for (const rawLine of decodeHtmlEntities(withBreaks).split(/\n+/)) {
    const line = rawLine.replace(/\s+/g, ' ').trim();
    if (!line || BOILERPLATE_LINE.test(line)) continue;

    if (line.length <= 360) {
      lines.push(line);
      continue;
    }

    let remaining = line;
    while (remaining.length > 360) {
      const boundary = remaining.lastIndexOf(' ', 360);
      const splitAt = boundary >= 240 ? boundary : 360;
      lines.push(remaining.slice(0, splitAt).trim());
      remaining = remaining.slice(splitAt).trim();
    }
    if (remaining) lines.push(remaining);
  }

  return lines;
}

function extractElements(html: string, tagNames: string): string[] {
  const values: string[] = [];
  const pattern = new RegExp(`<(${tagNames})\\b[^>]*>([\\s\\S]*?)<\\/\\1\\s*>`, 'gi');
  for (const match of html.matchAll(pattern)) {
    values.push(...textLinesFromHtml(match[2] ?? ''));
  }
  return values;
}

function appendUniqueLines(target: string[], seen: Set<string>, lines: string[]): void {
  for (const line of lines) {
    const key = line.toLocaleLowerCase('en-GB');
    if (seen.has(key)) continue;
    seen.add(key);
    target.push(line);
  }
}

function parseImageDimension(value: string | undefined): number | null {
  if (!value || !/^\d{1,5}$/.test(value)) return null;
  const dimension = Number(value);
  return dimension > 0 ? dimension : null;
}

function largestSrcsetImage(rawSrcset: string): string {
  let bestUrl = '';
  let bestSize = -1;

  for (const rawCandidate of rawSrcset.split(',')) {
    const [url = '', descriptor = ''] = rawCandidate.trim().split(/\s+/, 2);
    const size = Number.parseFloat(descriptor);
    const comparableSize = Number.isFinite(size) ? size : bestUrl ? -1 : 0;
    if (url && comparableSize > bestSize) {
      bestUrl = url;
      bestSize = comparableSize;
    }
  }

  return bestUrl;
}

function collectAiImageCandidates(html: string, productUrl: string): ProductAiImageCandidate[] {
  const candidates = new Map<
    string,
    Omit<ProductAiImageCandidate, 'index'> & { documentOrder: number; score: number }
  >();
  let documentOrder = 0;

  for (const match of html.matchAll(/<img\b([^>]*)>/gi)) {
    const attributes = parseAttributes(match[1] ?? '');
    const rawUrl =
      attributes.get('data-old-hires') ||
      attributes.get('data-zoom-image') ||
      largestSrcsetImage(attributes.get('data-srcset') ?? '') ||
      largestSrcsetImage(attributes.get('srcset') ?? '') ||
      attributes.get('data-src') ||
      attributes.get('data-lazy-src') ||
      attributes.get('data-original') ||
      attributes.get('src') ||
      '';
    const url = normaliseProductImageUrl(decodeHtmlEntities(rawUrl), productUrl);
    if (!url || url.length > MAX_AI_IMAGE_URL_CHARACTERS) continue;

    const alt = cleanText(attributes.get('alt') ?? '').slice(0, 160);
    const title = cleanText(attributes.get('title') ?? '').slice(0, 120);
    const width = parseImageDimension(attributes.get('width'));
    const height = parseImageDimension(attributes.get('height'));
    const context = cleanText(
      [attributes.get('id'), attributes.get('class'), alt, title, url].filter(Boolean).join(' ')
    ).toLowerCase();

    if (
      /(?:^|[\s_/-])(?:avatar|captcha|cookie|icon|logo|payment|pixel|rating|social|spinner|tracking)(?:[\s_/.?-]|$)/i.test(
        context
      ) ||
      (width !== null && height !== null && (width < 64 || height < 64))
    ) {
      continue;
    }

    const area = (width ?? 0) * (height ?? 0);
    const score =
      (alt ? 30 : 0) +
      (title ? 10 : 0) +
      (area >= 250_000 ? 30 : area >= 40_000 ? 15 : 0) +
      (/(?:product|primary|main|hero|zoom|large|hires)/i.test(context) ? 20 : 0);
    const candidate = { url, alt, title, width, height, documentOrder, score };
    documentOrder += 1;

    const existing = candidates.get(url);
    if (!existing || candidate.score > existing.score) candidates.set(url, candidate);
  }

  return [...candidates.values()]
    .sort((left, right) => right.score - left.score || left.documentOrder - right.documentOrder)
    .slice(0, MAX_AI_IMAGE_CANDIDATES)
    .map((candidate, index) => ({
      index,
      url: candidate.url,
      alt: candidate.alt,
      title: candidate.title,
      width: candidate.width,
      height: candidate.height
    }));
}

export async function preparePageEvidenceForAi(
  html: string,
  productUrl: string
): Promise<PreparedAiEvidence> {
  const removeHandler: HTMLRewriterElementContentHandlers = {
    element(element) {
      element.remove();
    }
  };

  let rewriter = new HTMLRewriter();
  for (const selector of AI_REMOVAL_SELECTORS) {
    rewriter = rewriter.on(selector, removeHandler);
  }

  const reducedHtml = await rewriter
    .transform(
      new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      })
    )
    .text();

  const headings = extractElements(reducedHtml, 'h1|h2');
  const mainSections = extractElements(reducedHtml, 'main|article');
  const bodySections = extractElements(reducedHtml, 'body');
  const contentLines = mainSections.length
    ? mainSections
    : bodySections.length
      ? bodySections
      : textLinesFromHtml(reducedHtml);
  const priceIndexes = new Set<number>();

  for (const [index, line] of contentLines.entries()) {
    if (/(?:£|GBP\b|\bprice\b|\bnow\b|\bwas\b)\s*\d|\d[\d,.]*\s*(?:GBP\b)/i.test(line)) {
      priceIndexes.add(Math.max(0, index - 1));
      priceIndexes.add(index);
      priceIndexes.add(Math.min(contentLines.length - 1, index + 1));
    }
  }

  const chosen: string[] = [];
  const seen = new Set<string>();
  appendUniqueLines(chosen, seen, headings);
  appendUniqueLines(
    chosen,
    seen,
    [...priceIndexes].sort((left, right) => left - right).map((index) => contentLines[index] ?? '')
  );
  appendUniqueLines(chosen, seen, contentLines);

  let pageText = '';
  for (const line of chosen) {
    const addition = `${pageText ? '\n' : ''}${line}`;
    if (pageText.length + addition.length > MAX_AI_PAGE_CHARACTERS) break;
    pageText += addition;
  }

  return {
    pageText,
    imageCandidates: collectAiImageCandidates(reducedHtml, productUrl)
  };
}
