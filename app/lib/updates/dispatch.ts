import { parseAutomaticUpdateConfig } from './config';

/** The timer starts the same release-only workflow used for manual updates. */
export async function dispatchAutomaticUpdate(
  source: unknown,
  scheduledTime: number,
  request: typeof fetch = fetch
): Promise<'disabled' | 'dispatched'> {
  const config = parseAutomaticUpdateConfig(source);
  if (!config) return 'disabled';
  if (!Number.isFinite(scheduledTime) || !Number.isFinite(new Date(scheduledTime).getTime()))
    throw new Error('The automatic update timer supplied an invalid time.');
  let response: Response;
  try {
    response = await request(
      `https://api.github.com/repos/${config.repository}/actions/workflows/update-household.yml/dispatches`,
      {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${config.token}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Family-Wishlist-Updater',
          'X-GitHub-Api-Version': '2026-03-10'
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: { automatic: true, scheduled_time: new Date(scheduledTime).toISOString() }
        })
      }
    );
  } catch {
    // Network exceptions and upstream bodies can contain credentials. Never forward them.
    throw new Error(
      'Could not contact GitHub to start the update. Check the Worker logs and retry.'
    );
  }
  // The response body is unnecessary; a cancellation failure must not expose upstream details.
  await response.body?.cancel().catch(() => undefined);
  if (response.status !== 200 && response.status !== 204)
    throw new Error(
      `GitHub rejected the automatic update (HTTP ${response.status}). Check that the workflow is enabled and the token has Actions read/write access to this repository.`
    );
  return 'dispatched';
}
