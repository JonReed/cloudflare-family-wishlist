import {
  type ProductMetadataOptions,
  type ProductMetadata,
  ProductMetadataError,
  type ProductDiagnostics,
  type ExtractedMetadata,
  ProductRenderError
} from './product-metadata/types';
import { normaliseProductUrl } from './product-url';
import {
  FETCH_TIMEOUT_MS,
  assertPublicTarget,
  truncateHtmlToBytes,
  MAX_HTML_BYTES,
  productPageRequestHeaders,
  MAX_REDIRECTS,
  readBoundedHtml
} from './product-metadata/transport';
import { retailerAdapter } from './product-metadata/retailers';
import { extractMetadata } from './product-metadata/extract';
import { enhanceMetadataWithAi } from './product-metadata/ai';

export { DEFAULT_PRODUCT_AI_MODEL } from './product-metadata/ai';
export type { ProductPageRenderer } from './product-metadata/types';
export type { ProductMetadata } from './product-metadata/types';
export type { ProductAiExtractor } from './product-metadata/types';
export type { ProductDiagnostics } from './product-metadata/types';
export { ProductMetadataError } from './product-metadata/types';
export { createWorkersAiProductExtractor } from './product-metadata/ai';
export { createBrowserRunProductRenderer } from './product-metadata/browser';

export async function fetchProductMetadata(
  input: unknown,
  blockedHostname: string,
  options: ProductMetadataOptions = {}
): Promise<ProductMetadata> {
  const fetchPage = options.fetchPage ?? ((url: string, init: RequestInit) => fetch(url, init));
  const normalised = normaliseProductUrl(input);
  if (!normalised) {
    throw new ProductMetadataError(
      'That link doesn’t look right. Use an address beginning with http:// or https://.'
    );
  }

  let target = new URL(normalised);
  let productUrl = target.toString();
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  let redirectCount = 0;
  let challengeRetries = 0;
  let browserAttempted = false;
  const diagnostics: ProductDiagnostics = { hostname: target.hostname, steps: [] };
  let stage = 'Direct fetch';
  const started = Date.now();
  const note = (message: string): void => {
    diagnostics.steps.push(message);
  };

  try {
    const renderFallback = async (): Promise<{
      html: string;
      metadata: ExtractedMetadata;
    } | null> => {
      if (browserAttempted) return null;
      if (!options.renderPage) {
        note('Browser fallback: not configured');
        return null;
      }
      browserAttempted = true;
      stage = 'Browser fallback';

      try {
        const rendered = await options.renderPage(target.toString());
        if (!rendered) {
          note('Browser fallback: service returned no usable page');
          return null;
        }

        for (const navigationUrl of [...rendered.navigationUrls, rendered.finalUrl]) {
          assertPublicTarget(new URL(navigationUrl), blockedHostname);
        }

        const finalTarget = new URL(rendered.finalUrl, target);
        const finalAdapter = retailerAdapter(finalTarget);
        const renderedProductUrl =
          finalTarget.toString() === target.toString()
            ? productUrl
            : (finalAdapter?.canonicalUrl(finalTarget).toString() ?? finalTarget.toString());
        const html = truncateHtmlToBytes(
          rendered.html,
          finalAdapter?.htmlByteLimit ?? MAX_HTML_BYTES
        );
        const metadata = await extractMetadata(html, renderedProductUrl);
        note(
          metadata.challengeDetected
            ? 'Browser fallback: verification page'
            : 'Browser fallback: page received'
        );
        return metadata.challengeDetected ? null : { html, metadata };
      } catch (error) {
        note(
          error instanceof ProductRenderError
            ? `Browser fallback: ${error.message}`
            : error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)
              ? 'Browser fallback: timed out'
              : 'Browser fallback: failed or unsafe response rejected'
        );
        console.warn(
          JSON.stringify({
            event: 'product_browser_render_rejected',
            errorName: error instanceof Error ? error.name : 'UnknownError'
          })
        );
        return null;
      }
    };

    const applyRetailerRetry = (): boolean => {
      if (challengeRetries !== 0) return false;
      const adapter = retailerAdapter(target);
      const retryTarget = adapter?.retryUrl(target);
      if (!adapter || !retryTarget || retryTarget.toString() === target.toString()) return false;

      challengeRetries += 1;
      stage = 'Retailer retry';
      productUrl = adapter.canonicalUrl(target).toString();
      target = retryTarget;
      return true;
    };

    while (true) {
      assertPublicTarget(target, blockedHostname);

      const response = await fetchPage(target.toString(), {
        method: 'GET',
        redirect: 'manual',
        cache: 'no-store',
        signal,
        headers: productPageRequestHeaders()
      });
      note(`${stage}: HTTP ${response.status}`);

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location || redirectCount >= MAX_REDIRECTS) {
          await response.body?.cancel();
          throw new ProductMetadataError('That shop sent us through too many redirects.');
        }
        await response.body?.cancel();
        redirectCount += 1;
        target = new URL(location, target);
        productUrl = target.toString();
        continue;
      }

      if (!response.ok) {
        await response.body?.cancel();
        if ([403, 429, 503].includes(response.status)) {
          if (applyRetailerRetry()) continue;
          const rendered = await renderFallback();
          if (rendered) {
            let { metadata } = rendered;
            if (options.extractWithAi) {
              metadata = await enhanceMetadataWithAi(
                rendered.html,
                metadata,
                options.extractWithAi,
                note
              );
            }
            if (metadata.title || metadata.price) {
              return {
                productUrl: metadata.productUrl,
                title: metadata.title,
                price: metadata.price,
                imageUrl: metadata.imageUrl,
                aiAssisted: metadata.aiAssisted
              };
            }
            note('Extraction: no usable name or price found');
          }
        }
        throw new ProductMetadataError('That page wouldn’t share its product details.');
      }

      const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
      if (contentType && !contentType.includes('text/html') && !contentType.includes('xhtml')) {
        note(`${stage}: not an HTML page`);
        await response.body?.cancel();
        throw new ProductMetadataError('That link isn’t an ordinary product page.');
      }

      let html = await readBoundedHtml(
        response,
        retailerAdapter(target)?.htmlByteLimit ?? MAX_HTML_BYTES
      );
      let metadata = await extractMetadata(html, productUrl);
      if (metadata.challengeDetected) {
        note(`${stage}: verification page`);
        if (applyRetailerRetry()) continue;
        const rendered = await renderFallback();
        if (rendered) {
          html = rendered.html;
          metadata = rendered.metadata;
        } else {
          throw new ProductMetadataError(
            'That shop showed a verification page instead of the product. You can still add the details by hand.'
          );
        }
      } else if (!metadata.title && !metadata.price) {
        note(`${stage}: no name or price found`);
        const rendered = await renderFallback();
        if (rendered) {
          html = rendered.html;
          metadata = rendered.metadata;
        }
      }
      if (options.extractWithAi) {
        metadata = await enhanceMetadataWithAi(html, metadata, options.extractWithAi, note);
      }
      if (!metadata.title && !metadata.price) {
        note('Extraction: no usable name or price found');
        throw new ProductMetadataError(
          'We couldn’t find a name or price on that page. You can still add the details by hand.'
        );
      }

      return {
        productUrl: metadata.productUrl,
        title: metadata.title,
        price: metadata.price,
        imageUrl: metadata.imageUrl,
        aiAssisted: metadata.aiAssisted
      };
    }
  } catch (error) {
    if (!(error instanceof ProductMetadataError)) {
      note(
        error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)
          ? `${stage}: timed out`
          : `${stage}: request or processing failed`
      );
    }
    note(`Total: ${Date.now() - started} ms`);
    if (error instanceof ProductMetadataError) {
      error.diagnostics = diagnostics;
      throw error;
    }
    console.error(
      JSON.stringify({
        event: 'product_metadata_fetch_failed',
        errorName: error instanceof Error ? error.name : 'UnknownError'
      })
    );
    const failure = new ProductMetadataError(
      'We couldn’t fetch that page. Check the link and try again.'
    );
    failure.diagnostics = diagnostics;
    throw failure;
  }
}
