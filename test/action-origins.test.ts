import { describe, expect, it } from 'vitest';

import { allowedActionOriginsForEnvironment } from '../app/lib/action-origins';

describe('allowedActionOriginsForEnvironment', () => {
  it('allows the Vite proxy only in local development', () => {
    expect(allowedActionOriginsForEnvironment(undefined, true)).toEqual(['**']);
  });

  it('normalises the configured production hostname', () => {
    expect(allowedActionOriginsForEnvironment('  Wishlist.Example.COM  ', false)).toEqual([
      'wishlist.example.com'
    ]);
  });

  it.each([
    undefined,
    '',
    'https://wishlist.example.com',
    'wishlist.example.com/profile',
    'wishlist.example.com:443',
    '.example.com',
    'example..com',
    '-wishlist.example.com'
  ])('fails closed for a missing or malformed production hostname: %s', (hostname) => {
    expect(allowedActionOriginsForEnvironment(hostname, false)).toEqual([]);
  });
});
