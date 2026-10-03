import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyUpdateWorkflow } from '../scripts/configure-updates';

const token = `github_pat_${'x'.repeat(30)}`;
afterEach(() => vi.restoreAllMocks());

describe('automatic update setup preflight', () => {
  it('verifies the selected active household workflow', async () => {
    const request = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        Response.json({ state: 'active', path: '.github/workflows/update-household.yml' })
      );
    await verifyUpdateWorkflow('household/wishlist', token);
    expect(request).toHaveBeenCalledWith(
      'https://api.github.com/repos/household/wishlist/actions/workflows/update-household.yml',
      expect.objectContaining({ redirect: 'error' })
    );
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('rejects the maintainer target before making a request', async () => {
    const request = vi.spyOn(globalThis, 'fetch');
    await expect(verifyUpdateWorkflow('JonReed/cloudflare-family-wishlist', token)).rejects.toThrow(
      'household repository'
    );
    expect(request).not.toHaveBeenCalled();
  });
  it.each(['disabled_manually', 'disabled_inactivity'])(
    'refuses to configure a disabled workflow (%s)',
    async (state) => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        Response.json({ state, path: '.github/workflows/update-household.yml' })
      );
      await expect(verifyUpdateWorkflow('household/wishlist', token)).rejects.toThrow(
        'Enable Update Family Wishlist'
      );
    }
  );
  it('does not disclose credential-bearing network failures or response bodies', async () => {
    const request = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error(token));
    await expect(verifyUpdateWorkflow('household/wishlist', token)).rejects.toThrow(
      'Could not check GitHub'
    );
    request.mockResolvedValue(new Response(token, { status: 403 }));
    await expect(verifyUpdateWorkflow('household/wishlist', token)).rejects.toThrow('HTTP 403');
  });
  it('checks permission to start the workflow before storing the key', async () => {
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        Response.json({ state: 'active', path: '.github/workflows/update-household.yml' })
      )
      .mockResolvedValueOnce(new Response(token, { status: 403 }));
    await expect(verifyUpdateWorkflow('household/wishlist', token)).rejects.toThrow(
      'update-start check failed (HTTP 403)'
    );
  });
});
