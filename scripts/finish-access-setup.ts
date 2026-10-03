import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import Cloudflare from 'cloudflare';

import { configureAccessSharing } from './configure-access-sharing.ts';
import { configureAccessSession } from './configure-access-session.ts';
import { checkSetup, type WranglerRunner } from './check-setup.ts';
import {
  parseInstallationSettings,
  prepareInstallationConfig,
  readInstallationSettings,
  type InstallationSettings
} from './installation-config.ts';

type RecordValue = Record<string, unknown>;
export type AccessSetup = {
  applicationId: string;
  workerId: string;
  teamDomain: string;
  hostname: string;
  organiserEmail: string;
  otpId: string;
};

function record(value: unknown): value is RecordValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseAccessSetup(source: string): AccessSetup {
  const value: unknown = JSON.parse(source);
  const patterns: Record<keyof AccessSetup, RegExp> = {
    applicationId: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    workerId: /^[0-9a-f]{32}$/i,
    teamDomain: /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.cloudflareaccess\.com$/,
    hostname:
      /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/,
    organiserEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    otpId: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  };
  if (!record(value) || Object.keys(value).some((key) => !Object.hasOwn(patterns, key))) {
    throw new Error('Access setup must contain only the six fields in docs/AGENT_INSTALLATION.md.');
  }
  for (const [key, pattern] of Object.entries(patterns)) {
    const field = value[key];
    if (typeof field !== 'string' || !pattern.test(field) || field !== field.trim()) {
      throw new Error(`Access setup requires a valid ${key}.`);
    }
  }
  if ((value.organiserEmail as string).length > 254)
    throw new Error('Organiser email is too long.');
  return value as AccessSetup;
}

/** Validate the actual Access destination and admission rules before installing any secrets. */
export function verifyAccessApplication(
  application: unknown,
  policies: unknown[],
  setup: AccessSetup
): string {
  if (
    !record(application) ||
    application.id !== setup.applicationId ||
    application.type !== 'self_hosted'
  ) {
    throw new Error('The selected Access application is not the expected self-hosted application.');
  }
  const destinations = application.destinations;
  if (
    !Array.isArray(destinations) ||
    destinations.length !== 1 ||
    !record(destinations[0]) ||
    destinations[0].type !== 'worker' ||
    destinations[0].worker_id !== setup.workerId
  ) {
    throw new Error(
      'Access must protect all traffic for the selected Worker only. Check its worker destination ID; previews-only protection is insufficient.'
    );
  }
  if (
    !Array.isArray(application.allowed_idps) ||
    application.allowed_idps.length !== 1 ||
    application.allowed_idps[0] !== setup.otpId
  ) {
    throw new Error('The Access application must use only the verified one-time PIN provider.');
  }
  if (
    application.http_only_cookie_attribute !== true ||
    application.same_site_cookie_attribute !== 'lax'
  ) {
    throw new Error('Set Access cookies to HttpOnly and SameSite Lax before finishing setup.');
  }
  if (typeof application.aud !== 'string' || !/^[0-9a-f]{64}$/i.test(application.aud)) {
    throw new Error('Cloudflare returned no valid Access audience tag.');
  }
  let organiserAllowed = false;
  if (!policies.length)
    throw new Error('The Access application has no readable admission policies.');
  for (const policy of policies) {
    if (
      !record(policy) ||
      policy.decision !== 'allow' ||
      !Array.isArray(policy.include) ||
      !policy.include.length ||
      (policy.exclude !== undefined &&
        (!Array.isArray(policy.exclude) || policy.exclude.length !== 0)) ||
      (policy.require !== undefined &&
        (!Array.isArray(policy.require) || policy.require.length !== 0)) ||
      (policy.session_duration && policy.session_duration !== '720h')
    ) {
      throw new Error(
        'Access policies must allow exact emails and inherit the 30-day application session. Review the existing policy; it was not changed.'
      );
    }
    for (const rule of policy.include) {
      if (
        !record(rule) ||
        Object.keys(rule).length !== 1 ||
        !record(rule.email) ||
        Object.keys(rule.email).length !== 1 ||
        typeof rule.email.email !== 'string' ||
        rule.email.email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rule.email.email)
      ) {
        throw new Error(
          'An Access rule admits more than an exact email address. Review it before continuing.'
        );
      }
      if (rule.email.email.toLowerCase() === setup.organiserEmail.toLowerCase())
        organiserAllowed = true;
    }
  }
  if (!organiserAllowed)
    throw new Error('The organiser email is absent from the Access allow-list.');
  return application.aud;
}

export type AccessSetupDependencies = {
  inspect: () => Promise<{ application: unknown; policies: unknown[] }>;
  session: typeof configureAccessSession;
  sharing: typeof configureAccessSharing;
  installSecrets: (values: Record<string, string>) => void;
  check: (env: NodeJS.ProcessEnv, beforeLogin: boolean) => Promise<string[]>;
};

export async function finishAccessSetup(
  installation: InstallationSettings,
  setup: AccessSetup,
  apiToken: string,
  dependencies: AccessSetupDependencies,
  checkOnly = false
): Promise<string[]> {
  // Also validate callers that did not read JSON through the CLI.
  parseInstallationSettings(JSON.stringify(installation));
  parseAccessSetup(JSON.stringify(setup));
  if (!apiToken.trim() || /[\r\n]/.test(apiToken))
    throw new Error(
      'Supply the scoped Access token through the private prompt or secret environment.'
    );
  const env = {
    ACCESS_MANAGEMENT_ACCOUNT_ID: installation.accountId,
    ACCESS_MANAGEMENT_APPLICATION_ID: setup.applicationId,
    ACCESS_MANAGEMENT_API_TOKEN: apiToken,
    WISHLIST_PUBLIC_HOSTNAMES: setup.hostname
  };
  // Fail on missing migrations or a Worker bound to another database BEFORE making Access writes.
  await dependencies.check({}, true);
  const { application, policies } = await dependencies.inspect();
  const audience = verifyAccessApplication(application, policies, setup);
  if (!checkOnly) {
    await dependencies.session({
      accountId: installation.accountId,
      applicationId: setup.applicationId,
      apiToken
    });
    await dependencies.sharing(env, [setup.hostname]);
    dependencies.installSecrets({
      ACCESS_TEAM_DOMAIN: setup.teamDomain,
      ACCESS_AUD: audience,
      INITIAL_ORGANISER_EMAIL: setup.organiserEmail.toLowerCase(),
      ACCESS_MANAGEMENT_ACCOUNT_ID: installation.accountId,
      ACCESS_MANAGEMENT_APPLICATION_ID: setup.applicationId,
      ACCESS_MANAGEMENT_API_TOKEN: apiToken
    });
  }
  return dependencies.check(env, false);
}

function wranglerRunner(configPath: string): WranglerRunner {
  return (args) => {
    const result = spawnSync(
      process.execPath,
      [resolve('node_modules/wrangler/bin/wrangler.js'), ...args, '--config', configPath],
      {
        encoding: 'utf8',
        env: { ...process.env, NO_COLOR: '1' }
      }
    );
    return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  };
}

async function main(): Promise<void> {
  let apiToken = '';
  try {
    const args = process.argv.slice(2);
    if (args.includes('--help')) {
      console.log(
        'Usage: npm run setup:access -- .private/access-setup.json [--check]\nReads the scoped token privately, verifies D1 and Access, configures sessions/sharing, and installs all six runtime settings in one request. --check makes no remote changes. See docs/AGENT_INSTALLATION.md.'
      );
      return;
    }
    if (args.length < 1 || args.length > 2 || (args[1] !== undefined && args[1] !== '--check'))
      throw new Error('Supply an Access setup JSON file. Use --help for the command.');
    const installation = readInstallationSettings({ required: true });
    if (!installation) throw new Error('Installation settings are missing.');
    if (
      process.env.CLOUDFLARE_ACCOUNT_ID &&
      process.env.CLOUDFLARE_ACCOUNT_ID !== installation.accountId
    )
      throw new Error(
        'CLOUDFLARE_ACCOUNT_ID selects another account. Remove that override before continuing.'
      );
    const setup = parseAccessSetup(readFileSync(args[0], 'utf8'));
    const configPath = prepareInstallationConfig({ required: true });
    apiToken = process.env.ACCESS_MANAGEMENT_API_TOKEN ?? '';
    if (!apiToken) {
      const { privateTokenPrompt } = await import('./private-token-prompt.ts');
      apiToken = await privateTokenPrompt();
    }
    const client = new Cloudflare({ apiToken, logLevel: 'off', maxRetries: 0, timeout: 8_000 });
    const messages = await finishAccessSetup(
      installation,
      setup,
      apiToken,
      {
        inspect: async () => {
          const application = await client.zeroTrust.access.applications.get(setup.applicationId, {
            account_id: installation.accountId
          });
          const policies: unknown[] = [];
          for await (const policy of client.zeroTrust.access.applications.policies.list(
            setup.applicationId,
            { account_id: installation.accountId }
          ))
            policies.push(policy);
          return { application, policies };
        },
        session: configureAccessSession,
        sharing: configureAccessSharing,
        installSecrets: (values) => {
          // No secret file, command-line argument, shell interpolation or token output.
          const result = spawnSync(
            process.execPath,
            [
              resolve('node_modules/wrangler/bin/wrangler.js'),
              'secret',
              'bulk',
              '--config',
              configPath
            ],
            {
              encoding: 'utf8',
              input: JSON.stringify(values),
              env: process.env
            }
          );
          if (result.status !== 0)
            throw new Error(
              'Could not save Worker settings. Check Wrangler authentication and Workers edit permission, then rerun setup:access.'
            );
        },
        check: (env, beforeLogin) =>
          checkSetup(installation, wranglerRunner(configPath), env, undefined, { beforeLogin })
      },
      args[1] === '--check'
    );
    for (const message of messages) console.log(`✓ ${message}`);
    console.log(
      'Infrastructure checks passed. Next: verify signed-out access, then complete organiser login and the family checks in docs/AGENT_INSTALLATION.md.'
    );
  } catch (error) {
    // SDK exceptions can contain request details. Only our own errors are suitable for display.
    const message =
      error instanceof Cloudflare.APIError
        ? `Cloudflare rejected a setup request (HTTP ${error.status ?? 'unknown'}). Check the scoped token's account and Access: Apps and Policies edit permission.`
        : error instanceof Error
          ? error.message
          : 'Unknown setup failure.';
    console.error(
      `Access setup stopped: ${apiToken ? message.replaceAll(apiToken, '[redacted]') : message}\nKeep the existing resources. Correct the failed check and rerun this command; do not create another database or disable Access.`
    );
    process.exitCode = 1;
  }
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) await main();
