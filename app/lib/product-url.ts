const MAX_PRODUCT_URL_LENGTH = 2048;
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

function stripHostnameBrackets(hostname: string): string {
  return hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
}

function isPrivateIpv4(hostname: string): boolean {
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

function isPrivateIpv6(hostname: string): boolean {
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

function isPrivateHostname(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.home.arpa') ||
    isPrivateIpv4(hostname) ||
    isPrivateIpv6(hostname)
  );
}

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

/**
 * Normalise an image address that will be loaded automatically in a family member's browser.
 * Images must use HTTPS and must not point at obvious local or private-network targets.
 */
export function normaliseProductImageUrl(input: unknown, baseUrl?: string): string | null {
  if (typeof input !== 'string') return null;

  const candidate = input.trim();
  if (candidate.length === 0 || candidate.length > MAX_PRODUCT_URL_LENGTH) return null;

  try {
    const url = baseUrl ? new URL(candidate, baseUrl) : new URL(candidate);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    if (isPrivateHostname(stripHostnameBrackets(url.hostname))) return null;

    return url.toString();
  } catch {
    return null;
  }
}
