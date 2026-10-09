const GUEST_SECRET = /^[A-Za-z0-9_-]{43}$/;

export function validGuestSecret(value: unknown): value is string {
  return typeof value === 'string' && GUEST_SECRET.test(value);
}

export function createGuestSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

export async function hashGuestSecret(secret: string): Promise<string> {
  if (!validGuestSecret(secret)) throw new Error('Invalid guest credential.');
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function isLocalHttpRequest(request: Request): boolean {
  const url = new URL(request.url);
  return url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
}

function cookieName(request: Request): string {
  return isLocalHttpRequest(request) ? 'wishlist-guest' : '__Host-wishlist-guest';
}

export function readGuestSecret(request: Request): string | null {
  const name = cookieName(request);
  const values = (request.headers.get('Cookie') ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`))
    .map((part) => part.slice(name.length + 1));
  return values.length === 1 && validGuestSecret(values[0]) ? values[0] : null;
}

export function guestCookie(request: Request, secret: string): string {
  if (!validGuestSecret(secret)) throw new Error('Invalid guest credential.');
  return `${cookieName(request)}=${secret}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${isLocalHttpRequest(request) ? '' : '; Secure'}`;
}
