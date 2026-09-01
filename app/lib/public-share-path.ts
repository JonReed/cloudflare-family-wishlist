const SHARE_TOKEN = '[A-Za-z0-9_-]{22}';
const UUID =
  '[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}';

const SHARED_WISHLIST_PATH = new RegExp(`^/shared/${SHARE_TOKEN}/?$`);
const SHARED_IMAGE_PATH = new RegExp(`^/shared/${SHARE_TOKEN}/image/${UUID}/?$`);

export function isPublicSharePath(pathname: string): boolean {
  return SHARED_WISHLIST_PATH.test(pathname) || SHARED_IMAGE_PATH.test(pathname);
}

export function isPublicShareRequest(request: Request): boolean {
  return (
    (request.method === 'GET' || request.method === 'HEAD') &&
    isPublicSharePath(new URL(request.url).pathname)
  );
}

export function redactedRequestPath(pathname: string): string {
  if (SHARED_IMAGE_PATH.test(pathname)) return '/shared/:secret/image/:item';
  if (SHARED_WISHLIST_PATH.test(pathname)) return '/shared/:secret';
  if (pathname === '/shared' || pathname === '/shared/') return pathname;
  if (pathname.startsWith('/shared/')) return '/shared/:redacted';
  return pathname;
}
