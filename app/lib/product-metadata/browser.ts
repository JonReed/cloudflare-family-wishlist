import { MAX_RETAILER_HTML_BYTES, readBoundedHtml } from './transport';
import { type ProductPageRenderer, ProductRenderError } from './types';
import { isRecord } from './text';

const MAX_BROWSER_RESPONSE_BYTES = MAX_RETAILER_HTML_BYTES * 2 + 64 * 1024;

const BROWSER_TIMEOUT_MS = 10_000;

function browserRunResponseMetadata(response: Response): Record<string, number | string> {
  const rawBrowserMilliseconds = response.headers.get('x-browser-ms-used');
  const browserMilliseconds = Number(rawBrowserMilliseconds);
  return {
    status: response.status,
    ...(rawBrowserMilliseconds !== null && Number.isFinite(browserMilliseconds)
      ? { browserMilliseconds }
      : {})
  };
}

export function createBrowserRunProductRenderer(browser: BrowserRun): ProductPageRenderer {
  return async (url) => {
    try {
      const response = await browser.quickAction('content', {
        url,
        gotoOptions: {
          waitUntil: 'networkidle2',
          timeout: BROWSER_TIMEOUT_MS
        },
        actionTimeout: BROWSER_TIMEOUT_MS,
        bestAttempt: true,
        cacheTTL: 300,
        // Product images are read from the DOM, not downloaded by the renderer.
        // Avoid spending the fallback allowance on heavy binary resources.
        rejectResourceTypes: ['image', 'media', 'font']
      });
      const responseText = await readBoundedHtml(response, MAX_BROWSER_RESPONSE_BYTES);
      if (!response.ok) {
        console.warn(
          JSON.stringify({
            event: 'product_browser_render_failed',
            ...browserRunResponseMetadata(response)
          })
        );
        throw new ProductRenderError(`service HTTP ${response.status}`);
      }

      const parsed: unknown = JSON.parse(responseText);
      if (!isRecord(parsed) || parsed.success !== true || typeof parsed.result !== 'string') {
        console.warn(
          JSON.stringify({
            event: 'product_browser_render_invalid_response',
            ...browserRunResponseMetadata(response)
          })
        );
        throw new ProductRenderError('invalid service response');
      }

      const meta = isRecord(parsed.meta) ? parsed.meta : {};
      const originStatus = typeof meta.status === 'number' ? meta.status : null;
      if (originStatus !== null && originStatus >= 400) {
        console.warn(
          JSON.stringify({
            event: 'product_browser_render_failed',
            originStatus,
            ...browserRunResponseMetadata(response)
          })
        );
        throw new ProductRenderError(`shop HTTP ${originStatus}`);
      }
      const redirectChain = Array.isArray(meta.redirectChain) ? meta.redirectChain : [];
      const navigationUrls = redirectChain.flatMap((hop) => {
        if (!isRecord(hop) || typeof hop.url !== 'string') return [];
        const urls = [hop.url];
        if (isRecord(hop.headers) && typeof hop.headers.location === 'string') {
          try {
            urls.push(new URL(hop.headers.location, hop.url).toString());
          } catch {
            throw new Error('Browser Run returned an invalid redirect location.');
          }
        }
        return urls;
      });
      const finalUrl = typeof meta.finalUrl === 'string' ? meta.finalUrl : url;

      console.info(
        JSON.stringify({
          event: 'product_browser_render_succeeded',
          ...browserRunResponseMetadata(response)
        })
      );
      return { html: parsed.result, finalUrl, navigationUrls };
    } catch (error) {
      console.warn(
        JSON.stringify({
          event: 'product_browser_render_failed',
          errorName: error instanceof Error ? error.name : 'UnknownError'
        })
      );
      if (error instanceof ProductRenderError) throw error;
      throw new ProductRenderError(
        error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)
          ? 'timed out'
          : 'service failed or invalid response'
      );
    }
  };
}
