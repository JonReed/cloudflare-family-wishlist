export const automaticUpdateSecret = 'WISHLIST_UPDATE_CONFIG';

export type AutomaticUpdateConfig = { repository: string; token: string };

export function parseAutomaticUpdateConfig(source: unknown): AutomaticUpdateConfig | null {
  if (source === undefined || source === '') return null;
  let value: unknown;
  try {
    if (typeof source !== 'string') throw new Error();
    value = JSON.parse(source);
  } catch {
    throw new Error('Automatic update settings are invalid. Run updates:configure again.');
  }
  if (
    typeof value !== 'object' ||
    value === null ||
    Object.keys(value).length !== 2 ||
    !('repository' in value) ||
    typeof value.repository !== 'string' ||
    !/^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?\/[a-z0-9_.-]{1,100}$/i.test(value.repository) ||
    ['.', '..'].includes(value.repository.split('/')[1]) ||
    value.repository.toLowerCase() === 'jonreed/cloudflare-family-wishlist' ||
    !('token' in value) ||
    typeof value.token !== 'string' ||
    !/^github_pat_[a-zA-Z0-9_]{20,240}$/.test(value.token)
  )
    throw new Error('Use your household repository and its fine-grained GitHub Actions token.');
  return { repository: value.repository, token: value.token };
}
