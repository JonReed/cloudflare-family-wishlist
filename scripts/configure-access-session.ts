import { pathToFileURL } from 'node:url';

import Cloudflare from 'cloudflare';

const TARGET_SESSION_DURATION = '720h';
const ACCOUNT_ID_PATTERN = /^[0-9a-f]{32}$/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type JsonRecord = Record<string, unknown>;

export type AccessSessionConfiguration = {
  accountId: string;
  applicationId: string;
  apiToken: string;
};

type AccessApplicationsClient = {
  get(applicationId: string, accountId: string): Promise<unknown>;
  update(applicationId: string, accountId: string, body: JsonRecord): Promise<unknown>;
};

export type AccessSessionResult = {
  applicationName: string;
  changed: boolean;
  sessionDuration: typeof TARGET_SESSION_DURATION;
};

export type AccessSessionCheckResult = {
  applicationName: string;
  sessionDuration: typeof TARGET_SESSION_DURATION;
};

const WRITABLE_APPLICATION_FIELDS = [
  'allow_authenticate_via_warp',
  'allow_iframe',
  'allowed_idps',
  'app_launcher_visible',
  'auto_redirect_to_identity',
  'cors_headers',
  'custom_deny_message',
  'custom_deny_url',
  'custom_non_identity_deny_url',
  'custom_pages',
  'destinations',
  'domain',
  'eager_redirect_cookie_setting',
  'enable_binding_cookie',
  'http_only_cookie_attribute',
  'logo_url',
  'mfa_config',
  'name',
  'oauth_configuration',
  'options_preflight_bypass',
  'read_service_tokens_from_header',
  'same_site_cookie_attribute',
  'scim_config',
  'self_hosted_domains',
  'service_auth_401_redirect',
  'skip_app_launcher_login_page',
  'skip_interstitial',
  'tags',
  'type',
  'use_clientless_isolation_app_launcher_url'
] as const;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(record: JsonRecord, key: string): string | null {
  return typeof record[key] === 'string' ? record[key] : null;
}

function applicationName(application: JsonRecord): string {
  return readString(application, 'name') ?? 'Cloudflare Access application';
}

function policyLinks(value: unknown): Array<string | { id: string; precedence?: number }> {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error('The Access application has no readable policies; refusing to update it.');
  }

  return value.map((policy) => {
    if (typeof policy === 'string' && UUID_PATTERN.test(policy)) return policy;
    if (!isRecord(policy)) {
      throw new Error(
        'The Access application returned an unreadable policy; refusing to update it.'
      );
    }

    const id = readString(policy, 'id');
    if (!id || !UUID_PATTERN.test(id)) {
      throw new Error(
        'The Access application returned an invalid policy ID; refusing to update it.'
      );
    }

    return typeof policy.precedence === 'number' ? { id, precedence: policy.precedence } : { id };
  });
}

function policyIds(value: unknown): string[] {
  return policyLinks(value).map((policy) => (typeof policy === 'string' ? policy : policy.id));
}

function stableValue(value: unknown): string {
  return JSON.stringify(value ?? null);
}

function assertExpectedApplication(
  value: unknown,
  configuration: AccessSessionConfiguration
): asserts value is JsonRecord {
  if (!isRecord(value)) {
    throw new Error('Cloudflare returned an unreadable Access application.');
  }

  if (readString(value, 'id') !== configuration.applicationId) {
    throw new Error('Cloudflare returned a different Access application than the one requested.');
  }

  if (readString(value, 'type') !== 'self_hosted') {
    throw new Error('The configured Access application is not a self-hosted application.');
  }

  if (typeof value.domain !== 'string') {
    throw new Error('The Access application has no readable domain; refusing to update it.');
  }

  if (!Array.isArray(value.destinations) || value.destinations.length === 0) {
    throw new Error('The Access application has no readable destinations; refusing to update it.');
  }

  const audience = readString(value, 'aud');
  if (!audience) {
    throw new Error('The Access application has no readable audience; refusing to update it.');
  }

  policyLinks(value.policies);
}

function buildUpdateBody(application: JsonRecord): JsonRecord {
  const body: JsonRecord = {};

  for (const field of WRITABLE_APPLICATION_FIELDS) {
    if (application[field] !== undefined) body[field] = application[field];
  }

  body.policies = policyLinks(application.policies);
  body.session_duration = TARGET_SESSION_DURATION;
  return body;
}

function assertConfigurationPreserved(before: JsonRecord, after: JsonRecord): void {
  const preservedFields = [
    'id',
    'aud',
    'type',
    'domain',
    'name',
    'destinations',
    'allowed_idps',
    'auto_redirect_to_identity',
    'allow_authenticate_via_warp',
    'http_only_cookie_attribute',
    'same_site_cookie_attribute',
    'enable_binding_cookie'
  ] as const;

  for (const field of preservedFields) {
    if (stableValue(before[field]) !== stableValue(after[field])) {
      throw new Error(`Cloudflare changed ${field} while updating the session duration.`);
    }
  }

  if (stableValue(policyIds(before.policies)) !== stableValue(policyIds(after.policies))) {
    throw new Error(
      'Cloudflare changed the attached Access policies while updating the session duration.'
    );
  }
}

export function readAccessSessionConfiguration(
  env: NodeJS.ProcessEnv = process.env
): AccessSessionConfiguration {
  const accountId = env.ACCESS_MANAGEMENT_ACCOUNT_ID?.trim() ?? '';
  const applicationId = env.ACCESS_MANAGEMENT_APPLICATION_ID?.trim() ?? '';
  const apiToken = env.ACCESS_MANAGEMENT_API_TOKEN?.trim() ?? '';

  if (!ACCOUNT_ID_PATTERN.test(accountId)) {
    throw new Error('ACCESS_MANAGEMENT_ACCOUNT_ID must be a 32-character Cloudflare account ID.');
  }
  if (!UUID_PATTERN.test(applicationId)) {
    throw new Error('ACCESS_MANAGEMENT_APPLICATION_ID must be the Access application UUID.');
  }
  if (!apiToken) {
    throw new Error('ACCESS_MANAGEMENT_API_TOKEN must be set in the environment.');
  }

  return { accountId, applicationId, apiToken };
}

function createAccessApplicationsClient(apiToken: string): AccessApplicationsClient {
  const client = new Cloudflare({
    apiToken,
    logLevel: 'off',
    maxRetries: 0,
    timeout: 8_000
  });

  return {
    get: (applicationId, accountId) =>
      client.zeroTrust.access.applications.get(applicationId, { account_id: accountId }),
    update: (applicationId, accountId, body) =>
      client.zeroTrust.access.applications.update(applicationId, {
        account_id: accountId,
        ...body
      })
  };
}

export async function configureAccessSession(
  configuration: AccessSessionConfiguration,
  client: AccessApplicationsClient = createAccessApplicationsClient(configuration.apiToken)
): Promise<AccessSessionResult> {
  const application = await client.get(configuration.applicationId, configuration.accountId);
  assertExpectedApplication(application, configuration);

  if (application.session_duration === TARGET_SESSION_DURATION) {
    return {
      applicationName: applicationName(application),
      changed: false,
      sessionDuration: TARGET_SESSION_DURATION
    };
  }

  await client.update(
    configuration.applicationId,
    configuration.accountId,
    buildUpdateBody(application)
  );

  const verified = await client.get(configuration.applicationId, configuration.accountId);
  assertExpectedApplication(verified, configuration);
  assertConfigurationPreserved(application, verified);

  if (verified.session_duration !== TARGET_SESSION_DURATION) {
    throw new Error('Cloudflare did not retain the requested 30-day Access session duration.');
  }

  return {
    applicationName: applicationName(verified),
    changed: true,
    sessionDuration: TARGET_SESSION_DURATION
  };
}

export async function checkAccessSession(
  configuration: AccessSessionConfiguration,
  client: Pick<AccessApplicationsClient, 'get'> = createAccessApplicationsClient(
    configuration.apiToken
  )
): Promise<AccessSessionCheckResult> {
  const application = await client.get(configuration.applicationId, configuration.accountId);
  assertExpectedApplication(application, configuration);

  if (application.session_duration !== TARGET_SESSION_DURATION) {
    throw new Error('The Access application session duration is not the required 30 days (720h).');
  }

  return {
    applicationName: applicationName(application),
    sessionDuration: TARGET_SESSION_DURATION
  };
}

async function main(): Promise<void> {
  try {
    const result = await configureAccessSession(readAccessSessionConfiguration());
    const verb = result.changed ? 'Set' : 'Confirmed';
    console.log(
      `${verb} ${result.applicationName} Access sessions at 30 days (${result.sessionDuration}).`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown setup failure.';
    console.error(`Could not configure the Access session duration: ${message}`);
    process.exitCode = 1;
  }
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  await main();
}
