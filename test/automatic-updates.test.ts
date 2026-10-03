import { createExecutionContext, createScheduledController, env } from 'cloudflare:test';
import { describe, expect, it, vi } from 'vitest';

import { parseAutomaticUpdateConfig } from '../app/lib/updates/config';
import { dispatchAutomaticUpdate } from '../app/lib/updates/dispatch';
import { createAppWorker } from '../workers/app';

const token = `github_pat_${'x'.repeat(30)}`;
const settings = JSON.stringify({ repository: 'household/wishlist', token });
const time = Date.parse('2026-10-03T18:37:00Z');

describe('Cloudflare automatic update trigger', () => {
  it('keeps manual installations inactive without making an outbound request', async () => {
    const request = vi.fn<typeof fetch>();
    expect(await dispatchAutomaticUpdate(undefined, time, request)).toBe('disabled');
    expect(await dispatchAutomaticUpdate('', time, request)).toBe('disabled');
    expect(request).not.toHaveBeenCalled();
  });

  it.each([
    '{invalid secret',
    JSON.stringify({ repository: 'JonReed/cloudflare-family-wishlist', token }),
    JSON.stringify({ repository: 'household/wishlist?injected=true', token }),
    JSON.stringify({ repository: 'household/wishlist', token: `${token}\nInjected: x` }),
    JSON.stringify({ repository: 'household/wishlist', token: 'ghp_classic_token' }),
    JSON.stringify({ repository: 'household/wishlist', token, extra: true }),
    { repository: 'household/wishlist', token }
  ])('rejects malformed or unsafe settings before contacting GitHub (%#)', async (source) => {
    const request = vi.fn<typeof fetch>();
    await expect(dispatchAutomaticUpdate(source, time, request)).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  });

  it.each([200, 204])(
    'starts the household workflow on main with automatic inputs (HTTP %i)',
    async (status) => {
      const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status }));
      expect(await dispatchAutomaticUpdate(settings, time, request)).toBe('dispatched');
      const call = request.mock.calls[0];
      if (!call?.[1]) throw new Error('No update request');
      const [url, init] = call;
      expect(url).toBe(
        'https://api.github.com/repos/household/wishlist/actions/workflows/update-household.yml/dispatches'
      );
      expect(init?.method).toBe('POST');
      expect(init?.redirect).toBe('error');
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      const headers = new Headers(init?.headers);
      expect(headers.get('Authorization')).toBe(`Bearer ${token}`);
      expect(headers.get('X-GitHub-Api-Version')).toBe('2026-03-10');
      expect(init?.body).toBe(
        JSON.stringify({
          ref: 'main',
          inputs: { automatic: true, scheduled_time: '2026-10-03T18:37:00.000Z' }
        })
      );
    }
  );

  it.each([401, 403, 404, 422, 500])(
    'reports rejected requests without exposing upstream content (HTTP %i)',
    async (status) => {
      const request = vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(`private=${token}`, { status }));
      try {
        await dispatchAutomaticUpdate(settings, time, request);
        throw new Error('Expected the request to fail');
      } catch (error) {
        expect(String(error)).toContain(`HTTP ${status}`);
        expect(String(error)).not.toContain(token);
      }
    }
  );

  it('sanitizes network errors and rejects invalid timer values', async () => {
    const request = vi.fn<typeof fetch>().mockRejectedValue(new Error(`Authorization=${token}`));
    await expect(dispatchAutomaticUpdate(settings, time, request)).rejects.toThrow(
      'Could not contact GitHub'
    );
    await expect(dispatchAutomaticUpdate(settings, NaN, request)).rejects.toThrow('invalid time');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('exposes a real scheduled handler without a public update endpoint', async () => {
    const worker = createAppWorker(() => Promise.resolve(new Response('app')));
    if (!worker.scheduled) throw new Error('Worker has no scheduled handler');
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    try {
      await worker.scheduled(
        createScheduledController({ scheduledTime: time, cron: '37 */6 * * *' }),
        env,
        createExecutionContext()
      );
      expect(log).toHaveBeenCalledWith(
        JSON.stringify({
          event: 'automatic_update_trigger',
          result: 'disabled',
          scheduledTime: time
        })
      );
      expect(parseAutomaticUpdateConfig(settings)?.repository).toBe('household/wishlist');
    } finally {
      log.mockRestore();
    }
  });
});
