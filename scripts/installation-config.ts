import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { parseJsoncObject } from './jsonc.ts';

export type InstallationSettings = {
  accountId: string;
  workerName: string;
  databaseId: string;
  databaseName: string;
};

export const INSTALLATION_FILE = '.wishlist-installation.json';
export const GENERATED_CONFIG = 'wrangler.installation.json';

/** Installation input is data, never an arbitrary Wrangler override or executable source. */
export function parseInstallationSettings(source: string): InstallationSettings {
  const value = parseJsoncObject(source, 'Installation settings');
  const patterns: Record<keyof InstallationSettings, RegExp> = {
    accountId: /^[0-9a-f]{32}$/i,
    workerName: /^[a-z0-9][a-z0-9-]{0,62}$/,
    databaseId: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    databaseName: /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/
  };
  for (const key of Object.keys(value)) {
    if (!Object.hasOwn(patterns, key)) throw new Error(`Unknown installation setting: ${key}.`);
  }
  const read = (key: keyof InstallationSettings): string => {
    const field = value[key];
    if (typeof field !== 'string' || !patterns[key].test(field)) {
      throw new Error(`Installation settings require a valid ${key}.`);
    }
    return field;
  };
  return {
    accountId: read('accountId'),
    workerName: read('workerName'),
    databaseId: read('databaseId'),
    databaseName: read('databaseName')
  };
}

export function readInstallationSettings({
  directory = process.cwd(),
  env = process.env,
  required = false
}: {
  directory?: string;
  env?: NodeJS.ProcessEnv;
  required?: boolean;
} = {}): InstallationSettings | null {
  // An explicitly supplied build value wins as a complete unit. Never mix installations.
  if (env.WISHLIST_INSTALLATION !== undefined) {
    return parseInstallationSettings(env.WISHLIST_INSTALLATION);
  }
  const file = resolve(directory, INSTALLATION_FILE);
  if (existsSync(file)) return parseInstallationSettings(readFileSync(file, 'utf8'));
  if (required) {
    throw new Error(
      `No installation settings. Create ${INSTALLATION_FILE} or set WISHLIST_INSTALLATION before running a deployment or remote command.`
    );
  }
  return null;
}

export function installationWranglerConfig(
  source: string,
  installation: InstallationSettings
): Record<string, unknown> {
  const config = parseJsoncObject(source);
  const databases = config.d1_databases;
  if (!Array.isArray(databases) || databases.length !== 1) {
    throw new Error('The shared configuration must contain exactly one D1 binding.');
  }
  const db: unknown = databases[0];
  if (typeof db !== 'object' || db === null || !('binding' in db) || db.binding !== 'DB') {
    throw new Error('The shared configuration must name its D1 binding DB.');
  }
  return {
    ...config,
    name: installation.workerName,
    account_id: installation.accountId,
    d1_databases: [
      { ...db, database_id: installation.databaseId, database_name: installation.databaseName }
    ]
  };
}

/** Regenerate from current inputs; a stale generated file is never a settings source. */
export function prepareInstallationConfig(
  options: {
    directory?: string;
    env?: NodeJS.ProcessEnv;
    required?: boolean;
  } = {}
): string {
  const directory = options.directory ?? process.cwd();
  const installation = readInstallationSettings({ ...options, directory });
  if (!installation) return resolve(directory, 'wrangler.jsonc');
  const env = options.env ?? process.env;
  if (env.CLOUDFLARE_ACCOUNT_ID && env.CLOUDFLARE_ACCOUNT_ID !== installation.accountId) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID does not match the installation settings.');
  }
  if (env.CLOUDFLARE_ENV) {
    throw new Error('Select a separate installation rather than a CLOUDFLARE_ENV override.');
  }
  const shared = readFileSync(resolve(directory, 'wrangler.jsonc'), 'utf8');
  const config = installationWranglerConfig(shared, installation);
  const outputPath = resolve(directory, GENERATED_CONFIG);
  const output = `${JSON.stringify(config, null, 2)}\n`;
  if (!existsSync(outputPath) || readFileSync(outputPath, 'utf8') !== output) {
    writeFileSync(outputPath, output, { mode: 0o600 });
  }
  return outputPath;
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  try {
    prepareInstallationConfig({ required: true });
    console.log(
      `Installation configuration prepared in ${GENERATED_CONFIG}. No Cloudflare resources were changed.`
    );
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : 'Could not prepare installation settings.'
    );
    process.exitCode = 1;
  }
}
