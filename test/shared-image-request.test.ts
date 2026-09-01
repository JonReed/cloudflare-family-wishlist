import { describe, expect, it } from 'vitest';

import { sharedImageHeadResponse } from '../app/lib/shared-image-request';

describe('shared image request handling', () => {
  it('answers HEAD without an upstream response body', async () => {
    const response = sharedImageHeadResponse('HEAD');

    expect(response?.status).toBe(200);
    expect(response?.headers.get('Content-Type')).toBe('application/octet-stream');
    await expect(response?.arrayBuffer()).resolves.toHaveProperty('byteLength', 0);
  });

  it('leaves GET to the budgeted upstream image path', () => {
    expect(sharedImageHeadResponse('GET')).toBeNull();
  });
});
