import type { PageEvidence } from './types';
import { cleanText } from './text';

function addEvidence(evidence: PageEvidence, key: string, rawValue: string): void {
  const value = cleanText(rawValue);
  if (!value) return;

  const values = evidence.values.get(key) ?? [];
  if (!values.includes(value)) values.push(value);
  evidence.values.set(key, values);
}

export function firstEvidence(evidence: PageEvidence, keys: string[]): string {
  for (const key of keys) {
    const value = evidence.values.get(key)?.[0];
    if (value) return value;
  }
  return '';
}

const VOID_HTML_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
]);

function isVoidHtmlElement(element: Element): boolean {
  return VOID_HTML_ELEMENTS.has(element.tagName.toLowerCase());
}

function textCaptureHandler(
  evidence: PageEvidence,
  keyForElement: string | (() => string)
): HTMLRewriterElementContentHandlers {
  const activeCaptures: Array<{ chunks: string[]; key: string }> = [];

  return {
    element(element) {
      // HTMLRewriter throws when onEndTag() is registered on a void element.
      // Attribute evidence for these elements is collected by the handlers below;
      // they cannot contain text for this handler to capture.
      if (isVoidHtmlElement(element)) return;

      const capture = {
        chunks: [] as string[],
        key: typeof keyForElement === 'string' ? keyForElement : keyForElement()
      };
      activeCaptures.push(capture);
      element.onEndTag(() => {
        const index = activeCaptures.indexOf(capture);
        if (index >= 0) activeCaptures.splice(index, 1);
        addEvidence(evidence, capture.key, capture.chunks.join(' '));
      });
    },
    text(text) {
      for (const capture of activeCaptures) capture.chunks.push(text.text);
    }
  };
}

const TEXT_EVIDENCE_SELECTORS = [
  ['document-title', 'title'],
  ['title-product', '#productTitle'],
  ['title-amazon-legacy', '#btAsinTitle'],
  ['title-amazon-heading', 'h1.a-size-large'],
  ['title-item-name', '#item_name'],
  ['title-product-name', '#product-name'],
  ['title-product-name', '#product_name'],
  ['title-product-name', '#productName'],
  ['price-to-pay', '.priceToPay'],
  ['price-to-pay', '.apex-pricetopay-value'],
  ['price-amazon-offscreen', '.a-price .a-offscreen'],
  ['price-visible', '.product-price'],
  ['price-visible', '.product_price'],
  ['price-visible', '.price-amount']
] as const;

export async function extractPageEvidence(html: string): Promise<PageEvidence> {
  const evidence: PageEvidence = {
    meta: new Map(),
    values: new Map(),
    challengeDetected: false
  };
  let productMicrodataDepth = 0;

  let rewriter = new HTMLRewriter();
  for (const [key, selector] of TEXT_EVIDENCE_SELECTORS) {
    rewriter = rewriter.on(selector, textCaptureHandler(evidence, key));
  }

  rewriter = rewriter
    .on('[itemtype*="Product"]', {
      element(element) {
        if (isVoidHtmlElement(element)) return;
        productMicrodataDepth += 1;
        element.onEndTag(() => {
          productMicrodataDepth -= 1;
        });
      }
    })
    .on(
      '[itemprop="name"]',
      textCaptureHandler(evidence, () =>
        productMicrodataDepth > 0 ? 'product-microdata-name-text' : 'microdata-name-text'
      )
    )
    .on(
      '[itemprop="price"]',
      textCaptureHandler(evidence, () =>
        productMicrodataDepth > 0 ? 'product-microdata-price-text' : 'microdata-price-text'
      )
    )
    .on('meta', {
      element(element) {
        const key =
          element.getAttribute('property') ??
          element.getAttribute('name') ??
          element.getAttribute('itemprop');
        const content = element.getAttribute('content');
        if (key && content && !evidence.meta.has(key.toLowerCase())) {
          evidence.meta.set(key.toLowerCase(), cleanText(content));
        }
      }
    })
    .on('[itemprop]', {
      element(element) {
        const itemProperties = (element.getAttribute('itemprop') ?? '').toLowerCase().split(/\s+/);
        const value =
          element.getAttribute('content') ??
          element.getAttribute('value') ??
          element.getAttribute('src') ??
          element.getAttribute('href') ??
          '';

        if (itemProperties.includes('name')) addEvidence(evidence, 'microdata-name', value);
        if (itemProperties.includes('price')) addEvidence(evidence, 'microdata-price', value);
        if (itemProperties.includes('pricecurrency')) {
          addEvidence(evidence, 'microdata-currency', value);
        }
        if (itemProperties.includes('image')) addEvidence(evidence, 'microdata-image', value);
        if (productMicrodataDepth > 0) {
          if (itemProperties.includes('name')) {
            addEvidence(evidence, 'product-microdata-name', value);
          }
          if (itemProperties.includes('price')) {
            addEvidence(evidence, 'product-microdata-price', value);
          }
          if (itemProperties.includes('pricecurrency')) {
            addEvidence(evidence, 'product-microdata-currency', value);
          }
          if (itemProperties.includes('image')) {
            addEvidence(evidence, 'product-microdata-image', value);
          }
        }
      }
    })
    .on('#landingImage', {
      element(element) {
        addEvidence(
          evidence,
          'amazon-image-old-hires',
          element.getAttribute('data-old-hires') ?? ''
        );
        addEvidence(
          evidence,
          'amazon-image-dynamic',
          element.getAttribute('data-a-dynamic-image') ?? ''
        );
        addEvidence(evidence, 'amazon-image-src', element.getAttribute('src') ?? '');
      }
    })
    .on('#imgTagWrapperId img', {
      element(element) {
        addEvidence(
          evidence,
          'amazon-image-old-hires',
          element.getAttribute('data-old-hires') ?? ''
        );
        addEvidence(
          evidence,
          'amazon-image-dynamic',
          element.getAttribute('data-a-dynamic-image') ?? ''
        );
        addEvidence(evidence, 'amazon-image-src', element.getAttribute('src') ?? '');
      }
    })
    .on('[data-asin-price]', {
      element(element) {
        addEvidence(evidence, 'amazon-data-price', element.getAttribute('data-asin-price') ?? '');
        addEvidence(
          evidence,
          'amazon-data-currency',
          element.getAttribute('data-asin-currency-code') ?? ''
        );
      }
    })
    .on('[data-asin-currency-code]', {
      element(element) {
        addEvidence(
          evidence,
          'amazon-data-currency',
          element.getAttribute('data-asin-currency-code') ?? ''
        );
      }
    })
    .on('#attach-base-product-price', {
      element(element) {
        addEvidence(evidence, 'amazon-attach-base-price', element.getAttribute('value') ?? '');
      }
    })
    .on('input[name]', {
      element(element) {
        const name = element.getAttribute('name')?.toLowerCase() ?? '';
        const match = /^items\[\d+\.base\]\[customervisibleprice\]\[(\w+)\]$/.exec(name);
        if (!match?.[1]) return;

        const field = match[1];
        const value = element.getAttribute('value') ?? '';
        if (field === 'displaystring') addEvidence(evidence, 'amazon-base-display', value);
        if (field === 'amount') addEvidence(evidence, 'amazon-base-amount', value);
        if (field === 'currencycode') addEvidence(evidence, 'amazon-base-currency', value);
      }
    })
    .on('#captchacharacters', {
      element() {
        evidence.challengeDetected = true;
      }
    })
    .on('form[action]', {
      element(element) {
        if ((element.getAttribute('action') ?? '').toLowerCase().includes('validatecaptcha')) {
          evidence.challengeDetected = true;
        }
      }
    })
    .on('img[src]', {
      element(element) {
        if ((element.getAttribute('src') ?? '').toLowerCase().includes('captcha')) {
          evidence.challengeDetected = true;
        }
      }
    });

  await rewriter
    .transform(
      new Response(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      })
    )
    .arrayBuffer();

  const documentTitle = firstEvidence(evidence, ['document-title']);
  if (
    /\b(?:just a moment|robot check|captcha|verify (?:that )?you are human|security check|access denied|request blocked)\b/i.test(
      documentTitle
    )
  ) {
    evidence.challengeDetected = true;
  }

  return evidence;
}
