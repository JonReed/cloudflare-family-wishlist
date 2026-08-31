export type AccessManagementEnv = {
  ACCESS_MANAGEMENT_ACCOUNT_ID?: string;
  ACCESS_MANAGEMENT_APPLICATION_ID?: string;
  ACCESS_MANAGEMENT_API_TOKEN?: string;
};

type AccessManagementConfiguration = {
  accountId: string;
  applicationId: string;
  apiToken: string;
};

const CLOUDFLARE_API_ORIGIN = 'https://api.cloudflare.com';
const API_TIMEOUT_MS = 8_000;
const MAX_API_RESPONSE_BYTES = 64 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class AccessManagementError extends Error {
  constructor(
    message: string,
    readonly code: 'not_configured' | 'request_failed'
  ) {
    super(message);
    this.name = 'AccessManagementError';
  }
}

function readConfiguration(env: AccessManagementEnv): AccessManagementConfiguration {
  const accountId = env.ACCESS_MANAGEMENT_ACCOUNT_ID?.trim();
  const applicationId = env.ACCESS_MANAGEMENT_APPLICATION_ID?.trim();
  const apiToken = env.ACCESS_MANAGEMENT_API_TOKEN?.trim();

  if (
    !accountId ||
    !/^[0-9a-f]{32}$/i.test(accountId) ||
    !applicationId ||
    !UUID_PATTERN.test(applicationId) ||
    !apiToken
  ) {
    throw new AccessManagementError(
      'Adding family members is not configured yet. The person who set this up needs to finish the Cloudflare Access step.',
      'not_configured'
    );
  }

  return { accountId, applicationId, apiToken };
}

function policyUrl(configuration: AccessManagementConfiguration, policyId?: string): string {
  const base = `${CLOUDFLARE_API_ORIGIN}/client/v4/accounts/${configuration.accountId}/access/apps/${configuration.applicationId}/policies`;
  return policyId ? `${base}/${policyId}` : base;
}

async function readBoundedJson(response: Response): Promise<unknown> {
  if (!response.body) return null;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    totalBytes += value.byteLength;
    if (totalBytes > MAX_API_RESPONSE_BYTES) {
      await reader.cancel();
      throw new AccessManagementError(
        'Cloudflare returned an unexpected response while adding this person. Try again in a moment.',
        'request_failed'
      );
    }

    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new AccessManagementError(
      'Cloudflare returned an unexpected response while adding this person. Try again in a moment.',
      'request_failed'
    );
  }
}

function policyIdFromResponse(value: unknown): string | null {
  if (typeof value !== 'object' || value === null) return null;

  const envelope = value as { success?: unknown; result?: unknown };
  if (envelope.success !== true || typeof envelope.result !== 'object' || !envelope.result) {
    return null;
  }

  const result = envelope.result as { id?: unknown };
  return typeof result.id === 'string' && UUID_PATTERN.test(result.id) ? result.id : null;
}

async function cloudflareRequest(
  configuration: AccessManagementConfiguration,
  url: string,
  init: RequestInit,
  fetcher: typeof fetch
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    return await fetcher(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${configuration.apiToken}`,
        'Content-Type': 'application/json',
        ...init.headers
      },
      signal: controller.signal
    });
  } catch {
    throw new AccessManagementError(
      'Cloudflare could not add this person just now. Nothing has been saved, so it is safe to try again.',
      'request_failed'
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function grantFamilyMemberAccess(
  env: AccessManagementEnv,
  invitationId: string,
  email: string,
  fetcher: typeof fetch = fetch
): Promise<string> {
  if (
    !UUID_PATTERN.test(invitationId) ||
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  ) {
    throw new AccessManagementError(
      'The family invitation details were invalid. Refresh the page and try again.',
      'request_failed'
    );
  }

  const configuration = readConfiguration(env);
  const response = await cloudflareRequest(
    configuration,
    policyUrl(configuration),
    {
      method: 'POST',
      body: JSON.stringify({
        name: `Family Wishlist member ${invitationId.slice(0, 8)}`,
        decision: 'allow',
        include: [{ email: { email } }]
      })
    },
    fetcher
  );
  const policyId = policyIdFromResponse(await readBoundedJson(response));

  if (!response.ok || !policyId) {
    throw new AccessManagementError(
      'Cloudflare could not add this person just now. Nothing has been saved, so it is safe to try again.',
      'request_failed'
    );
  }

  return policyId;
}

export async function revokeFamilyMemberAccess(
  env: AccessManagementEnv,
  policyId: string,
  fetcher: typeof fetch = fetch
): Promise<void> {
  if (!UUID_PATTERN.test(policyId)) {
    throw new AccessManagementError(
      'Cloudflare could not tidy up an incomplete invitation.',
      'request_failed'
    );
  }

  const configuration = readConfiguration(env);
  const response = await cloudflareRequest(
    configuration,
    policyUrl(configuration, policyId),
    { method: 'DELETE' },
    fetcher
  );

  if (!response.ok) {
    throw new AccessManagementError(
      'Cloudflare could not tidy up an incomplete invitation.',
      'request_failed'
    );
  }

  await response.body?.cancel();
}
