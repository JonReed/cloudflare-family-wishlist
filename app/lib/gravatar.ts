import { avatarInitials } from './avatar-initials';
import { fetchRasterImage, RasterImageError } from './raster-image';

/** Gravatar's identifier stays server-side, rather than appearing in family pages. */
export async function gravatarUrl(email: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(email.trim().toLowerCase())
  );
  const hash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
  return `https://www.gravatar.com/avatar/${hash}?s=160&r=g&d=404`;
}

export function initialsAvatar(displayName: string): Response {
  // Only letters and numbers enter this locally generated SVG. Remote SVGs are rejected.
  return new Response(
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><rect width="160" height="160" fill="#e4e8d9"/><text x="80" y="84" text-anchor="middle" dominant-baseline="middle" font-family="Georgia,serif" font-size="64" fill="#284f3e">${avatarInitials(displayName)}</text></svg>`,
    { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'private, no-store' } }
  );
}

export async function fetchGravatar(
  member: { email: string; displayName: string },
  fetcher: typeof fetch = fetch
): Promise<Response> {
  try {
    const response = await fetchRasterImage(await gravatarUrl(member.email), fetcher);
    response.headers.set('X-Member-Avatar', '1');
    response.headers.set('Cache-Control', 'private, max-age=300');
    return response;
  } catch (error) {
    if (error instanceof RasterImageError) return initialsAvatar(member.displayName);
    throw error;
  }
}
