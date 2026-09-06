import { ProductMetadataError } from './types';

export const MAX_HTML_BYTES = 512 * 1024;

export const MAX_RETAILER_HTML_BYTES = 1024 * 1024;

export const MAX_REDIRECTS = 4;

export const FETCH_TIMEOUT_MS = 8_000;

export function productPageRequestHeaders(): Headers {
  // Use one coherent browser-navigation profile for every initial request,
  // redirect and retailer retry. Firefox ESR does not rely on Chromium client
  // hints, so the profile stays internally consistent without forwarding any
  // headers, cookies or identity from the signed-in family member.
  return new Headers({
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-GB,en;q=0.5',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none',
    'Sec-Fetch-User': '?1',
    'Upgrade-Insecure-Requests': '1',
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:140.0) Gecko/20100101 Firefox/140.0'
  });
}

function stripHostnameBrackets(hostname: string): string {
  return hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
}

function isBlockedIpv4(hostname: string): boolean {
  const parts = hostname.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return false;

  const octets = parts.map(Number);
  if (octets.some((octet) => octet > 255)) return true;

  const [first, second] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    first >= 224
  );
}

function isBlockedIpv6(hostname: string): boolean {
  if (!hostname.includes(':')) return false;

  const firstGroup = hostname.split(':', 1)[0] ?? '';
  const firstValue = Number.parseInt(firstGroup || '0', 16);

  return (
    hostname === '::' ||
    hostname === '::1' ||
    hostname.includes('::ffff:') ||
    (firstValue >= 0xfc00 && firstValue <= 0xfdff) ||
    (firstValue >= 0xfe80 && firstValue <= 0xfebf) ||
    firstValue >= 0xff00
  );
}

export function assertPublicTarget(url: URL, blockedHostname: string): void {
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new ProductMetadataError(
      'That link can’t be fetched. Use a public shop or product page.'
    );
  }

  const hostname = stripHostnameBrackets(url.hostname);
  const blocked = stripHostnameBrackets(blockedHostname);

  if (
    hostname === blocked ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.home.arpa') ||
    isBlockedIpv4(hostname) ||
    isBlockedIpv6(hostname)
  ) {
    throw new ProductMetadataError(
      'That link can’t be fetched. Use a public shop or product page.'
    );
  }
}

export async function readBoundedHtml(
  response: Response,
  byteLimit = MAX_HTML_BYTES
): Promise<string> {
  if (!response.body) return '';

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let html = '';

  try {
    while (bytesRead < byteLimit) {
      const { done, value } = await reader.read();
      if (done) break;

      const remaining = byteLimit - bytesRead;
      const chunk = value.byteLength > remaining ? value.subarray(0, remaining) : value;
      bytesRead += chunk.byteLength;
      html += decoder.decode(chunk, { stream: true });

      if (value.byteLength >= remaining) {
        await reader.cancel();
        break;
      }
    }

    html += decoder.decode();
    return html;
  } finally {
    reader.releaseLock();
  }
}

export function truncateHtmlToBytes(html: string, byteLimit: number): string {
  const encoded = new TextEncoder().encode(html);
  if (encoded.byteLength <= byteLimit) return html;
  return new TextDecoder().decode(encoded.subarray(0, byteLimit));
}
