import { readFileSync } from 'node:fs';
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

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function removeJsonComments(input: string): string {
  let output = '';
  let inString = false;
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    const next = input[index + 1];

    if (inString) {
      output += character;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }

    if (character === '"') {
      inString = true;
      output += character;
      continue;
    }

    if (character === '/' && next === '/') {
      while (index < input.length && input[index] !== '\n') index += 1;
      output += '\n';
      continue;
    }

    if (character === '/' && next === '*') {
      index += 2;
      while (index < input.length && !(input[index] === '*' && input[index + 1] === '/')) {
        output += input[index] === '\n' ? '\n' : ' ';
        index += 1;
      }
      index += 1;
      continue;
    }

    output += character;
  }

  return output;
}

function removeTrailingCommas(input: string): string {
  let output = '';
  let inString = false;
  let escaped = false;

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];
    if (inString) {
      output += character;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      output += character;
      continue;
    }
    if (character === ',') {
      let lookahead = index + 1;
      while (/\s/.test(input[lookahead] ?? '')) lookahead += 1;
      if (input[lookahead] === '}' || input[lookahead] === ']') continue;
    }
    output += character;
  }
  return output;
}

function requiredString(record: JsonRecord, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`wrangler.jsonc must contain a non-empty ${key}.`);
  }
  return value.trim();
}

export function parseSetupConfiguration(source: string): SetupConfiguration {
  let parsed: unknown;
  try {
    parsed = JSON.parse(removeTrailingCommas(removeJsonComments(source)));
  } catch {
    throw new Error('wrangler.jsonc is not valid JSONC.');
  }
  if (!isRecord(parsed)) throw new Error('wrangler.jsonc must contain an object.');

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
  const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const result = spawnSync(executable, ['--no-install', 'wrangler', ...args], {
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
  accessChecks: AccessChecks = { session: checkAccessSession, sharing: checkPublicSharingAccess }
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

  const deployment = jsonOutput(runner, ['deployments', 'status', '--json']);
  const versionIds = trafficVersionIds(deployment);
  for (const versionId of versionIds) {
    const bindings = bindingsFromVersion(
      jsonOutput(runner, ['versions', 'view', versionId, '--json'])
    );
    const bindingNames = new Set(
      bindings.flatMap((binding) => (typeof binding.name === 'string' ? [binding.name] : []))
    );
    const missingBindings = REQUIRED_BINDINGS.filter((name) => !bindingNames.has(name));
    if (missingBindings.length > 0) {
      throw new Error(
        `Traffic-bearing Worker version ${versionId} is missing bindings: ${missingBindings.join(', ')}.`
      );
    }
  }
  messages.push(
    'Every traffic-bearing Worker version has the required D1, AI, Browser and Access bindings.'
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
    const configuration = parseSetupConfiguration(readFileSync('wrangler.jsonc', 'utf8'));
    const messages = await checkSetup(configuration);
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
