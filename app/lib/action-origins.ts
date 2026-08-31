const HOSTNAME_PATTERN =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function allowedActionOriginsForEnvironment(
  publicHostname: string | undefined,
  isDevelopment: boolean
): string[] {
  if (isDevelopment) return ['**'];

  const hostname = publicHostname?.trim().toLowerCase() ?? '';
  return HOSTNAME_PATTERN.test(hostname) ? [hostname] : [];
}
