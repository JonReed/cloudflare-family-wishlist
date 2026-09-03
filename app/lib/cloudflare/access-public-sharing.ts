export type PublicSharingAccessEnv = {
  ACCESS_MANAGEMENT_ACCOUNT_ID?: string;
  ACCESS_MANAGEMENT_API_TOKEN?: string;
};

const CLOUDFLARE_API_ORIGIN = 'https://api.cloudflare.com';
const API_TIMEOUT_MS = 8_000;
const MAX_API_RESPONSE_BYTES = 256 * 1024;
const ACCOUNT_ID_PATTERN = /^[0-9a-f]{32}$/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HOSTNAME_PATTERN =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i;
const PUBLIC_PATHS = ['shared/*', 'shared-assets/*', 'favicon.svg'] as const;
const PUBLIC_POLICY_NAME = 'Public viewing links';

type JsonRecord = Record<string, unknown>;

type AccessSharingConfiguration = {
  accountId: string;
  apiToken: string;
};

export type PublicSharingAccessResult = {
  applicationId: string;
  applicationName: string;
  created: boolean;
  hostname: string;
};

export class PublicSharingAccessError extends Error {
  readonly code: 'not_configured' | 'invalid_hostname' | 'request_failed' | 'configuration_drift';

  constructor(
    message: string,
    code: 'not_configured' | 'invalid_hostname' | 'request_failed' | 'configuration_drift'
  ) {
    super(message);
    this.code = code;
    this.name = 'PublicSharingAccessError';
  }
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readConfiguration(env: PublicSharingAccessEnv): AccessSharingConfiguration {
  const accountId = env.ACCESS_MANAGEMENT_ACCOUNT_ID?.trim() ?? '';
  const apiToken = env.ACCESS_MANAGEMENT_API_TOKEN?.trim() ?? '';

  if (!ACCOUNT_ID_PATTERN.test(accountId) || !apiToken) {
    throw new PublicSharingAccessError(
      'Public sharing is not configured yet. The family organiser needs to finish the Cloudflare Access setup.',
      'not_configured'
    );
  }

  return { accountId, apiToken };
}

function normaliseHostname(hostname: string): string {
  const normalised = hostname.trim().toLowerCase().replace(/\.$/, '');
  if (!HOSTNAME_PATTERN.test(normalised)) {
    throw new PublicSharingAccessError(
      'This site address cannot be configured for public sharing.',
      'invalid_hostname'
    );
  }
  return normalised;
}

function applicationName(hostname: string): string {
  return `Family Wishlist public sharing — ${hostname}`;
}

function destinationUris(hostname: string): string[] {
  return PUBLIC_PATHS.map((path) => `${hostname}/${path}`);
}

async function readBoundedJson(response: Response): Promise<unknown> {
  if (!response.body) return null;
  const reader = (response.body as ReadableStream<Uint8Array>).getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    totalBytes += value.byteLength;
    if (totalBytes > MAX_API_RESPONSE_BYTES) {
      await reader.cancel();
      throw new PublicSharingAccessError(
        'Cloudflare returned an unexpected response while configuring public sharing.',
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
    throw new PublicSharingAccessError(
      'Cloudflare returned an unexpected response while configuring public sharing.',
      'request_failed'
    );
  }
}

async function cloudflareRequest(
  configuration: AccessSharingConfiguration,
  url: string,
  init: RequestInit,
  fetcher: typeof fetch
): Promise<{ response: Response; body: unknown }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const response = await fetcher(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${configuration.apiToken}`,
        'Content-Type': 'application/json',
        ...init.headers
      },
      signal: controller.signal
    });
    return { response, body: await readBoundedJson(response) };
  } catch (error) {
    if (error instanceof PublicSharingAccessError) throw error;
    throw new PublicSharingAccessError(
      'Cloudflare could not configure public sharing just now. No link was created, so it is safe to try again.',
      'request_failed'
    );
  } finally {
    clearTimeout(timeout);
  }
}

function listResult(value: unknown): JsonRecord[] | null {
  if (!isRecord(value) || value.success !== true || !Array.isArray(value.result)) return null;
  if (!value.result.every(isRecord)) return null;
  if (!isRecord(value.result_info)) return null;
  const info = value.result_info;
  if (
    info.page !== 1 ||
    info.total_pages !== 1 ||
    info.count !== value.result.length ||
    info.total_count !== value.result.length
  ) {
    return null;
  }
  return value.result;
}

function resultRecord(value: unknown): JsonRecord | null {
  if (!isRecord(value) || value.success !== true || !isRecord(value.result)) return null;
  return value.result;
}

function hasExactDestinations(application: JsonRecord, hostname: string): boolean {
  if (!Array.isArray(application.destinations)) return false;
  const actual = application.destinations.flatMap((destination) => {
    if (
      !isRecord(destination) ||
      destination.type !== 'public' ||
      typeof destination.uri !== 'string'
    ) {
      return [];
    }
    return [
      destination.uri
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\/$/, '')
    ];
  });
  const expected = destinationUris(hostname);
  return actual.length === expected.length && expected.every((uri) => actual.includes(uri));
}

function isEveryoneBypass(policy: unknown): boolean {
  if (!isRecord(policy) || policy.decision !== 'bypass' || !Array.isArray(policy.include)) {
    return false;
  }
  return (
    policy.name === PUBLIC_POLICY_NAME &&
    policy.include.length === 1 &&
    isRecord(policy.include[0]) &&
    isRecord(policy.include[0].everyone) &&
    Object.keys(policy.include[0].everyone).length === 0 &&
    (!('exclude' in policy) || (Array.isArray(policy.exclude) && policy.exclude.length === 0)) &&
    (!('require' in policy) || (Array.isArray(policy.require) && policy.require.length === 0))
  );
}

function managedApplication(
  applications: JsonRecord[],
  name: string,
  hostname: string
): JsonRecord | null {
  const matches = applications.filter((application) => application.name === name);
  if (matches.length > 1) {
    throw new PublicSharingAccessError(
      `More than one Access application is managing public sharing for ${hostname}. Review them in Cloudflare before creating another viewing link.`,
      'configuration_drift'
    );
  }
  return matches[0] ?? null;
}

function assertManagedApplication(application: JsonRecord, hostname: string): string {
  const id = application.id;
  const expectedName = applicationName(hostname);
  if (
    typeof id !== 'string' ||
    !UUID_PATTERN.test(id) ||
    application.type !== 'self_hosted' ||
    application.name !== expectedName ||
    !hasExactDestinations(application, hostname) ||
    !Array.isArray(application.policies) ||
    application.policies.length !== 1 ||
    !isEveryoneBypass(application.policies[0])
  ) {
    throw new PublicSharingAccessError(
      `The Access application for ${hostname} has changed. Review it in Cloudflare before creating another viewing link.`,
      'configuration_drift'
    );
  }
  return id;
}

function createBody(hostname: string): JsonRecord {
  const name = applicationName(hostname);
  return {
    type: 'self_hosted',
    name,
    domain: destinationUris(hostname)[0],
    destinations: destinationUris(hostname).map((uri) => ({ type: 'public', uri })),
    app_launcher_visible: false,
    policies: [
      {
        name: PUBLIC_POLICY_NAME,
        decision: 'bypass',
        precedence: 1,
        include: [{ everyone: {} }]
      }
    ]
  };
}

async function listApplications(
  configuration: AccessSharingConfiguration,
  fetcher: typeof fetch
): Promise<JsonRecord[]> {
  const url = `${CLOUDFLARE_API_ORIGIN}/client/v4/accounts/${configuration.accountId}/access/apps?page=1&per_page=1000`;
  const { response, body } = await cloudflareRequest(
    configuration,
    url,
    { method: 'GET' },
    fetcher
  );
  const applications = response.ok ? listResult(body) : null;
  if (!applications) {
    throw new PublicSharingAccessError(
      'Cloudflare could not safely inspect the Access applications. No viewing link was created.',
      'request_failed'
    );
  }
  return applications;
}

export async function ensurePublicSharingAccess(
  env: PublicSharingAccessEnv,
  requestedHostname: string,
  fetcher: typeof fetch = fetch
): Promise<PublicSharingAccessResult> {
  const configuration = readConfiguration(env);
  const hostname = normaliseHostname(requestedHostname);
  const name = applicationName(hostname);
  const applications = await listApplications(configuration, fetcher);
  const existing = managedApplication(applications, name, hostname);

  if (existing) {
    return {
      applicationId: assertManagedApplication(existing, hostname),
      applicationName: name,
      created: false,
      hostname
    };
  }

  const url = `${CLOUDFLARE_API_ORIGIN}/client/v4/accounts/${configuration.accountId}/access/apps`;
  const { response, body } = await cloudflareRequest(
    configuration,
    url,
    { method: 'POST', body: JSON.stringify(createBody(hostname)) },
    fetcher
  );
  const created = response.ok ? resultRecord(body) : null;

  if (created) {
    return {
      applicationId: assertManagedApplication(created, hostname),
      applicationName: name,
      created: true,
      hostname
    };
  }

  // Concurrent first-time requests can race. Re-read and accept the other request's
  // result only when it is exactly the narrowly scoped application we expected.
  const racedApplication = managedApplication(
    await listApplications(configuration, fetcher),
    name,
    hostname
  );
  if (racedApplication) {
    return {
      applicationId: assertManagedApplication(racedApplication, hostname),
      applicationName: name,
      created: false,
      hostname
    };
  }

  throw new PublicSharingAccessError(
    'Cloudflare could not configure public sharing. No viewing link was created.',
    'request_failed'
  );
}

export async function checkPublicSharingAccess(
  env: PublicSharingAccessEnv,
  requestedHostname: string,
  fetcher: typeof fetch = fetch
): Promise<PublicSharingAccessResult> {
  const configuration = readConfiguration(env);
  const hostname = normaliseHostname(requestedHostname);
  const name = applicationName(hostname);
  const existing = managedApplication(
    await listApplications(configuration, fetcher),
    name,
    hostname
  );

  if (!existing) {
    throw new PublicSharingAccessError(
      `The expected Access application for ${hostname} does not exist. Run the public-sharing setup command first.`,
      'configuration_drift'
    );
  }

  return {
    applicationId: assertManagedApplication(existing, hostname),
    applicationName: name,
    created: false,
    hostname
  };
}
