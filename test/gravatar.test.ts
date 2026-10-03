import { describe, expect, it, vi } from 'vitest';

import { fetchGravatar, gravatarUrl, initialsAvatar } from '../app/lib/gravatar';

describe('Gravatar pictures', () => {
  const member = { email: 'MyEmailAddress@example.com', displayName: 'Jamie Reed' };

  it('uses the normalised SHA-256 identifier, a family rating and no default image', async () => {
    await expect(gravatarUrl(' MyEmailAddress@example.com ')).resolves.toBe(
      'https://www.gravatar.com/avatar/84059b07d4be67b806386c0aad8070a23f18836bbaae342275dc0a83414c32ee?s=160&r=g&d=404'
    );
  });

  it('returns a raster photo without passing family identity or cookies upstream', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/jpeg' } })
      );
    const response = await fetchGravatar(member, fetcher);
    expect(response.headers.get('Content-Type')).toBe('image/jpeg');
    expect(response.headers.get('Cache-Control')).toBe('private, max-age=300');
    expect(response.headers.get('X-Member-Avatar')).toBe('1');
    const [url, init] = fetcher.mock.calls[0];
    expect(url).not.toContain(member.email);
    const headers = new Headers(init?.headers);
    for (const name of ['Cookie', 'Authorization', 'Cf-Access-Jwt-Assertion', 'Referer']) {
      expect(headers.has(name)).toBe(false);
    }
    expect(await response.arrayBuffer()).toHaveProperty('byteLength', 3);
  });

  it.each([404, 429, 503])('uses initials when Gravatar returns %s', async (status) => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('unavailable', { status }));
    const response = await fetchGravatar(member, fetcher);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/svg+xml');
    expect(await response.text()).toContain('>JR</text>');
  });

  it('uses initials for network failures and rejects remote SVG images', async () => {
    const failingFetch = vi.fn<typeof fetch>().mockRejectedValue(new Error('offline'));
    expect(await (await fetchGravatar(member, failingFetch)).text()).toContain('>JR</text>');
    const svgFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response('<svg onload="unsafe"/>', { headers: { 'Content-Type': 'image/svg+xml' } })
      );
    expect(await (await fetchGravatar(member, svgFetch)).text()).not.toContain('onload');
  });

  it('keeps names with markup out of the generated fallback', async () => {
    const svg = await initialsAvatar('<script> &bad').text();
    expect(svg).not.toContain('<script>');
    expect(svg).not.toContain('&bad');
    expect(svg).not.toContain('>undefined');
    expect(await initialsAvatar('Élodie').text()).toContain('>É</text>');
  });
});
