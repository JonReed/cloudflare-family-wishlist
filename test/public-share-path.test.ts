import { describe, expect, it } from 'vitest';

import {
  isPublicSharePath,
  isPublicShareRequest,
  redactedRequestPath
} from '../app/lib/public-share-path';

const token = 'a'.repeat(22);
const itemId = '2f7e4767-27b0-4b2d-a8e6-cd8bbba99930';

describe('public share request boundary', () => {
  it.each([`/shared/${token}`, `/shared/${token}/`, `/shared/${token}/image/${itemId}`])(
    'allows the exact read-only public path: %s',
    (path) => {
      expect(isPublicSharePath(path)).toBe(true);
      expect(isPublicShareRequest(new Request(`https://wishlist.example${path}`))).toBe(true);
    }
  );

  it.each(['GET', 'HEAD'])('allows %s for exact shared list and image paths', (method) => {
    expect(
      isPublicShareRequest(new Request(`https://wishlist.example/shared/${token}`, { method }))
    ).toBe(true);
    expect(
      isPublicShareRequest(
        new Request(`https://wishlist.example/shared/${token}/image/${itemId}`, { method })
      )
    ).toBe(true);
  });

  it.each([
    '/shared',
    '/shared/not-a-secret',
    `/shared/${token}/edit`,
    `/shared/${token}/image/not-an-item`,
    `/other/shared/${token}`
  ])('keeps every neighbouring path behind authentication: %s', (path) => {
    expect(isPublicSharePath(path)).toBe(false);
  });

  it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])('does not allow %s', (method) => {
    expect(
      isPublicShareRequest(new Request(`https://wishlist.example/shared/${token}`, { method }))
    ).toBe(false);
  });

  it('redacts capability paths from application logs', () => {
    expect(redactedRequestPath(`/shared/${token}`)).toBe('/shared/:secret');
    expect(redactedRequestPath(`/shared/${token}/image/${itemId}`)).toBe(
      '/shared/:secret/image/:item'
    );
    expect(redactedRequestPath(`/shared/${token}/unexpected`)).toBe('/shared/:redacted');
  });
});
