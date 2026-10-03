import { readFileSync } from 'node:fs';
import { wranglerInvocation } from './installation-wrangler.ts';
import { parseJsoncObject } from './jsonc.ts';
import { prepareInstallationConfig } from './installation-config.ts';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import { checkPublicSharingAccess } from '../app/lib/cloudflare/access-public-sharing.ts';
import { checkAccessSession, readAccessSessionConfiguration } from './configure-access-session.ts';

type JsonRecord = Record<string, unknown>;

export type SetupConfiguration = {
  accountId: string;
  databaseId: string;
  databaseName: string;
  workerName: string;
};

export type WranglerResult = {
  status: number | null;
  stderr: string;
  stdout: string;
};

export type WranglerRunner = (args: string[]) => WranglerResult;

type AccessChecks = {
  session: typeof checkAccessSession;
  sharing: typeof checkPublicSharingAccess;
};

const ACCOUNT_ID_PATTERN = /^[0-9a-f]{32}$/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REQUIRED_BINDINGS = [
  'ACCESS_AUD',
  'ACCESS_MANAGEMENT_ACCOUNT_ID',
  'ACCESS_MANAGEMENT_API_TOKEN',
  'ACCESS_MANAGEMENT_APPLICATION_ID',
  'ACCESS_TEAM_DOMAIN',
  'AI',
  'BROWSER',
  'DB',
  'INITIAL_ORGANISER_EMAIL'
] as const;
const ACCESS_CHECK_ENVIRONMENT = [
  'ACCESS_MANAGEMENT_ACCOUNT_ID',
  'ACCESS_MANAGEMENT_APPLICATION_ID',
  'ACCESS_MANAGEMENT_API_TOKEN',
  'WISHLIST_PUBLIC_HOSTNAMES'
] as const;

export const FIRST_LOGIN_SCHEMA_QUERY = `
  SELECT members.id, members.email, members.display_name, members.role,
    members.disabled_at, members.first_signed_in_at,
    wishlists.id AS wishlist_id, wishlists.owner_member_id,
    family_invitations.email AS invitation_email,
    family_invitations.display_name AS invitation_name,
    family_invitations.status AS invitation_status, family_invitations.access_policy_id
  FROM members
  LEFT JOIN wishlists ON wishlists.owner_member_id = members.id
  LEFT JOIN family_invitations ON family_invitations.email = members.email COLLATE NOCASE
  LIMIT 0
`
  .replace(/\s+/g, ' ')
  .trim();

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(record: JsonRecord, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`wrangler.jsonc must contain a non-empty ${key}.`);
  }
  return value.trim();
}

export function parseSetupConfiguration(source: string): SetupConfiguration {
  const parsed = parseJsoncObject(source);

  const accountId = requiredString(parsed, 'account_id');
  const workerName = requiredString(parsed, 'name');
  if (!ACCOUNT_ID_PATTERN.test(accountId)) {
    throw new Error('wrangler.jsonc account_id must be a 32-character Cloudflare account ID.');
  }

  const ai = parsed.ai;
  const browser = parsed.browser;
  if (!isRecord(ai) || ai.binding !== 'AI') {
    throw new Error('wrangler.jsonc must configure the Workers AI binding as AI.');
  }
  if (!isRecord(browser) || browser.binding !== 'BROWSER') {
    throw new Error('wrangler.jsonc must configure the Browser Rendering binding as BROWSER.');
  }

  if (!Array.isArray(parsed.d1_databases)) {
    throw new Error('wrangler.jsonc must configure a D1 database.');
  }
  const database = parsed.d1_databases.find(
    (candidate): candidate is JsonRecord => isRecord(candidate) && candidate.binding === 'DB'
  );
  if (!database) throw new Error('wrangler.jsonc must configure the D1 binding as DB.');
  const databaseId = requiredString(database, 'database_id');
  const databaseName = requiredString(database, 'database_name');
  if (!UUID_PATTERN.test(databaseId)) {
    throw new Error('wrangler.jsonc database_id must be a D1 database UUID.');
  }

  return { accountId, databaseId, databaseName, workerName };
}

function runWrangler(args: string[]): WranglerResult {
  const invocation = wranglerInvocation(args);
  const result = spawnSync(invocation.executable, invocation.args, {
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' }
  });
  return {
    status: result.status,
    stderr: result.stderr ?? '',
    stdout: result.stdout ?? ''
  };
}

function execute(runner: WranglerRunner, args: string[]): WranglerResult {
  const result = runner(args);
  if (result.status !== 0) {
    const summary = result.stderr.trim().split('\n').find(Boolean);
    throw new Error(
      `Wrangler command failed: wrangler ${args.join(' ')}${summary ? ` (${summary})` : ''}`
    );
  }
  return result;
}

function jsonOutput(runner: WranglerRunner, args: string[]): unknown {
  const output = execute(runner, args).stdout;
  try {
    return JSON.parse(output);
  } catch {
    throw new Error(`Wrangler returned unreadable JSON for: wrangler ${args.join(' ')}`);
  }
}

function bindingsFromVersion(value: unknown): JsonRecord[] {
  if (!isRecord(value) || !isRecord(value.resources) || !Array.isArray(value.resources.bindings)) {
    throw new Error('The current Worker version returned no readable bindings.');
  }
  return value.resources.bindings.filter(isRecord);
}

function trafficVersionIds(value: unknown): string[] {
  if (!isRecord(value) || !Array.isArray(value.versions)) {
    throw new Error('Wrangler returned no readable current Worker deployment.');
  }

  const versionIds = value.versions.flatMap((version) => {
    if (
      !isRecord(version) ||
      typeof version.version_id !== 'string' ||
      typeof version.percentage !== 'number' ||
      !Number.isFinite(version.percentage)
    ) {
      throw new Error('Wrangler returned an unreadable traffic-bearing Worker version.');
    }
    return version.percentage > 0 ? [version.version_id] : [];
  });

  if (versionIds.length === 0) {
    throw new Error('The Worker has no traffic-bearing deployed versions.');
  }
  return [...new Set(versionIds)];
}

export async function checkSetup(
  configuration: SetupConfiguration,
  runner: WranglerRunner = runWrangler,
  env: NodeJS.ProcessEnv = process.env,
  accessChecks: AccessChecks = { session: checkAccessSession, sharing: checkPublicSharingAccess },
  options: { beforeLogin?: boolean } = {}
): Promise<string[]> {
  const messages: string[] = [];

  execute(runner, ['types', '--check']);
  messages.push('Generated Worker binding types match wrangler.jsonc.');

  const identity = jsonOutput(runner, ['whoami', '--json']);
  const accounts = isRecord(identity) && Array.isArray(identity.accounts) ? identity.accounts : [];
  if (
    !accounts.some(
      (account) => isRecord(account) && account.id?.toString() === configuration.accountId
    )
  ) {
    throw new Error('Wrangler is not authenticated to the account configured in wrangler.jsonc.');
  }
  messages.push('Wrangler is authenticated to the configured Cloudflare account.');

  const database = jsonOutput(runner, ['d1', 'info', 'DB', '--json']);
  if (
    !isRecord(database) ||
    database.uuid !== configuration.databaseId ||
    database.name !== configuration.databaseName
  ) {
    throw new Error(
      'The DB binding does not resolve to the D1 database configured in wrangler.jsonc.'
    );
  }
  messages.push('The remote D1 database name and ID match wrangler.jsonc.');

  const migrations = execute(runner, ['d1', 'migrations', 'list', 'DB', '--remote']).stdout;
  if (!migrations.includes('No migrations to apply')) {
    throw new Error('The remote D1 database has pending migrations.');
  }
  messages.push('The remote D1 database has no pending migrations.');

  // A migration ledger alone does not prove the schema the first login needs exists.
  // LIMIT 0 checks member, wishlist and invitation columns without reading any family records.
  const schema = jsonOutput(runner, [
    'd1',
    'execute',
    'DB',
    '--remote',
    '--json',
    '--command',
    FIRST_LOGIN_SCHEMA_QUERY
  ]);
  if (
    !Array.isArray(schema) ||
    schema.length !== 1 ||
    !isRecord(schema[0]) ||
    schema[0].success !== true ||
    !Array.isArray(schema[0].results) ||
    schema[0].results.length !== 0
  ) {
    throw new Error(
      'Could not verify the first-login database schema. Inspect migrations before signing in.'
    );
  }
  messages.push(
    'The member, wishlist and invitation schema required for first sign-in is readable.'
  );

  const deployment = jsonOutput(runner, ['deployments', 'status', '--json']);
  const versionIds = trafficVersionIds(deployment);
  for (const versionId of versionIds) {
    const bindings = bindingsFromVersion(
      jsonOutput(runner, ['versions', 'view', versionId, '--json'])
    );
    const databases = bindings.filter((binding) => binding.name === 'DB');
    if (
      databases.length !== 1 ||
      databases[0].type !== 'd1' ||
      databases[0].id !== configuration.databaseId
    ) {
      throw new Error(
        `Traffic-bearing Worker version ${versionId} uses a different D1 database. Rebuild and deploy with this installation's settings before signing in.`
      );
    }
    const bindingNames = new Set(
      bindings.flatMap((binding) => (typeof binding.name === 'string' ? [binding.name] : []))
    );
    const required = options.beforeLogin ? ['DB', 'AI', 'BROWSER'] : REQUIRED_BINDINGS;
    const missingBindings = required.filter((name) => !bindingNames.has(name));
    if (missingBindings.length > 0) {
      throw new Error(
        `Traffic-bearing Worker version ${versionId} is missing bindings: ${missingBindings.join(', ')}.`
      );
    }
  }
  messages.push(
    options.beforeLogin
      ? 'Every traffic-bearing Worker version uses the intended D1 database and has AI and Browser bindings. Access setup is still required.'
      : 'Every traffic-bearing Worker version uses the intended D1 database and has the required AI, Browser and Access bindings.'
  );

  const supplied = ACCESS_CHECK_ENVIRONMENT.filter((name) => Boolean(env[name]?.trim()));
  if (supplied.length === 0) {
    messages.push(
      'Deep Access API checks were skipped; provide the four setup environment variables to enable them.'
    );
    return messages;
  }
  if (supplied.length !== ACCESS_CHECK_ENVIRONMENT.length) {
    const missing = ACCESS_CHECK_ENVIRONMENT.filter((name) => !env[name]?.trim());
    throw new Error(
      `Deep Access checks require all setup environment variables; missing ${missing.join(', ')}.`
    );
  }

  const sessionConfiguration = readAccessSessionConfiguration(env);
  if (sessionConfiguration.accountId !== configuration.accountId) {
    throw new Error('The Access setup account does not match the installation account.');
  }
  await accessChecks.session(sessionConfiguration);
  const hostnames = [
    ...new Set(
      (env.WISHLIST_PUBLIC_HOSTNAMES ?? '')
        .split(',')
        .map((hostname) => hostname.trim())
        .filter(Boolean)
    )
  ];
  for (const hostname of hostnames) {
    await accessChecks.sharing(env, hostname);
  }
  messages.push('The 30-day Access session and narrow public-sharing applications are exact.');
  return messages;
}

async function main(): Promise<void> {
  try {
    const args = process.argv.slice(2);
    if (args.includes('--help')) {
      console.log(
        'Usage: npm run setup:check [-- --before-login]\n--before-login checks D1, migrations and deployed database identity before Access bindings exist. It does not certify sign-in.'
      );
      return;
    }
    if (args.some((arg) => arg !== '--before-login'))
      throw new Error('Unknown setup:check argument. Use --help.');
    const configPath = prepareInstallationConfig({ required: true });
    const configuration = parseSetupConfiguration(readFileSync(configPath, 'utf8'));
    const messages = await checkSetup(
      configuration,
      (args) => runWrangler([...args, '--config', configPath]),
      process.env,
      undefined,
      { beforeLogin: args.includes('--before-login') }
    );
    for (const message of messages) console.log(`✓ ${message}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown setup check failure.';
    console.error(`Setup check failed: ${message}`);
    process.exitCode = 1;
  }
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  await main();
}
