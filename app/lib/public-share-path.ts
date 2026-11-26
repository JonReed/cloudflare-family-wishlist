export const COOKIE_PRIVACY_PATH = '/shared/cookies';

const SHARE_TOKEN = '(?:[A-Za-z0-9_-]{22}|[0-9a-f]{32})';
const SHARED_WISHLIST_PATH = new RegExp(`^/shared/${SHARE_TOKEN}/?$`);

export function isCookiePrivacyPath(pathname: string): boolean {
  return pathname === COOKIE_PRIVACY_PATH || pathname === COOKIE_PRIVACY_PATH + '/';
}

export function isPublicSharePath(pathname: string): boolean {
  return isCookiePrivacyPath(pathname) || SHARED_WISHLIST_PATH.test(pathname);
}

export function isPublicShareRequest(request: Request): boolean {
  return (
    ((request.method === 'GET' || request.method === 'HEAD') &&
      isPublicSharePath(new URL(request.url).pathname)) ||
    (request.method === 'POST' && SHARED_WISHLIST_PATH.test(new URL(request.url).pathname))
  );
}

export function redactedRequestPath(pathname: string): string {
  if (SHARED_WISHLIST_PATH.test(pathname)) return '/shared/:secret';
  if (pathname === '/shared' || pathname === '/shared/') return pathname;
  if (pathname.startsWith('/shared/')) return '/shared/:redacted';
  return pathname;
}
