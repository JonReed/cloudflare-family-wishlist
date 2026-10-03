import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  parseAccessSetup,
  verifyAccessApplication,
  type AccessSetup
} from './finish-access-setup.ts';
import { readInstallationSettings, type InstallationSettings } from './installation-config.ts';

export type CfRunner = (args: string[]) => unknown;
type JsonRecord = Record<string, unknown>;
function record(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function listCfResources(runner: CfRunner, args: string[]): JsonRecord[] {
  const results: JsonRecord[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= 100; page++) {
    const entries = runner([...args, '--page', String(page), '--per-page', '100']);
    if (
      !Array.isArray(entries) ||
      entries.some((entry) => !record(entry) || typeof entry.id !== 'string')
    ) {
      throw new Error(
        `cf returned an unreadable list for ${args.join(' ')}. No replacement resources were created.`
      );
    }
    for (const entry of entries as JsonRecord[]) {
      if (seen.has(entry.id as string))
        throw new Error('cf returned overlapping pages. Inspect live state before continuing.');
      seen.add(entry.id as string);
      results.push(entry);
    }
    if (entries.length < 100) return results;
  }
  throw new Error(
    'Could not read a complete Cloudflare resource list. No changes were made from this incomplete list.'
  );
}

export function accessApplicationBody(setup: Omit<AccessSetup, 'applicationId'>): JsonRecord {
  parseAccessSetup(
    JSON.stringify({ ...setup, applicationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })
  );
  return {
    type: 'self_hosted',
    name: `Family Wishlist — ${setup.workerId}`,
    destinations: [{ type: 'worker', worker_id: setup.workerId }],
    allowed_idps: [setup.otpId],
    session_duration: '720h',
    http_only_cookie_attribute: true,
    same_site_cookie_attribute: 'lax',
    policies: [
      {
        name: 'Family organiser',
        decision: 'allow',
        include: [{ email: { email: setup.organiserEmail.toLowerCase() } }]
      }
    ]
  };
}

export async function prepareAccessApplication(
  installation: InstallationSettings,
  input: { organiserEmail: string; hostname: string },
  runner: CfRunner,
  confirm: (message: string) => Promise<boolean>,
  previous: AccessSetup | null = null
): Promise<AccessSetup> {
  parseAccessSetup(
    JSON.stringify({
      ...input,
      applicationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      workerId: 'a'.repeat(32),
      teamDomain: 'test.cloudflareaccess.com',
      otpId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    })
  );
  const organisation = runner(['zero-trust', 'organization', 'get']);
  if (!record(organisation) || typeof organisation.auth_domain !== 'string') {
    throw new Error(
      'Finish Zero Trust Free account onboarding at https://one.dash.cloudflare.com/, then rerun this step.'
    );
  }
  parseAccessSetup(
    JSON.stringify({
      ...input,
      applicationId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      workerId: 'a'.repeat(32),
      teamDomain: organisation.auth_domain,
      otpId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
    })
  );
  const workers = listCfResources(runner, [
    'workers',
    'scripts',
    'search',
    '--name',
    installation.workerName
  ]).filter(
    (worker) =>
      worker.script_name === installation.workerName && worker.environment_is_default !== false
  );
  if (
    workers.length !== 1 ||
    typeof workers[0].id !== 'string' ||
    !/^[0-9a-f]{32}$/i.test(workers[0].id)
  ) {
    throw new Error(
      'Could not identify exactly one deployed Worker with the saved name. Complete the first deployment before configuring Access.'
    );
  }
  const providers = listCfResources(runner, ['zero-trust', 'identity-providers', 'list']).filter(
    (provider) => provider.type === 'onetimepin' && (!previous || provider.id === previous.otpId)
  );
  if (providers.length > 1)
    throw new Error(
      'More than one one-time PIN provider exists. Select the intended provider in a private Access setup file rather than guessing.'
    );
  const applications = listCfResources(runner, ['zero-trust', 'access', 'applications', 'list']);
  const workerId = workers[0].id;
  const name = `Family Wishlist — ${workerId}`;
  const matches = applications.filter(
    (app) =>
      app.name === name ||
      (Array.isArray(app.destinations) &&
        app.destinations.some(
          (destination: unknown) =>
            record(destination) &&
            (destination.worker_id === workerId ||
              [input.hostname, `${input.hostname}/`, `${input.hostname}/*`].includes(
                String(destination.uri)
              ))
        )) ||
      [input.hostname, `${input.hostname}/`, `${input.hostname}/*`].includes(String(app.domain))
  );
  if (matches.length > 1)
    throw new Error(
      'Several Access applications overlap this Worker or hostname. Review them before proceeding.'
    );
  if (
    previous &&
    (previous.workerId !== workerId ||
      previous.teamDomain !== organisation.auth_domain ||
      matches.length !== 1 ||
      matches[0].id !== previous.applicationId ||
      providers.length !== 1 ||
      providers[0].id !== previous.otpId)
  ) {
    throw new Error(
      'Saved Access settings no longer match the live resources. Keep them and investigate; no replacement was created.'
    );
  }
  if (
    !(await confirm(
      `Configure sign-in for ${input.organiserEmail} on Worker ${installation.workerName} in account ${installation.accountId}, with viewing links on ${input.hostname}? Existing conflicting settings will stop this command.`
    ))
  ) {
    throw new Error('Stopped without changing Access.');
  }
  let provider: unknown = providers[0];
  if (!provider) {
    if (matches.length)
      throw new Error(
        'An existing Access application has no verified one-time PIN provider. Review it before creating another provider.'
      );
    provider = runner([
      'zero-trust',
      'identity-providers',
      'create',
      '--body',
      JSON.stringify({ name: 'Email code', type: 'onetimepin', config: {} })
    ]);
  }
  if (!record(provider) || typeof provider.id !== 'string' || provider.type !== 'onetimepin')
    throw new Error(
      'Cloudflare did not return a verified one-time PIN provider. Rerun this step to inspect live state.'
    );
  const base = {
    ...input,
    workerId,
    teamDomain: organisation.auth_domain,
    otpId: provider.id
  };
  const body = accessApplicationBody(base);
  let application: unknown = matches[0];
  if (!application)
    application = runner([
      'zero-trust',
      'access',
      'applications',
      'create',
      '--body',
      JSON.stringify(body)
    ]);
  if (!record(application) || typeof application.id !== 'string')
    throw new Error(
      'Cloudflare did not return an Access application ID. Rerun this step to inspect live state before creating anything.'
    );
  const setup = parseAccessSetup(JSON.stringify({ ...base, applicationId: application.id }));
  // cf exposes attached policies in the application readback. Its separate policies list is for
  // reusable policies across the account, so it cannot verify this application's admission rules.
  const verified = runner(['zero-trust', 'access', 'applications', 'get', setup.applicationId]);
  if (!record(verified) || !Array.isArray(verified.policies))
    throw new Error(
      'cf did not return the attached Access policies. Keep the existing app and investigate before continuing.'
    );
  try {
    verifyAccessApplication(verified, verified.policies, setup);
  } catch (error) {
    throw new Error(
      `Access application ${setup.applicationId}: ${error instanceof Error ? error.message : 'Configuration could not be verified.'}`,
      { cause: error }
    );
  }
  return setup;
}

export function cfResourceEnvironment(
  accountId: string,
  env: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
  return {
    ...env,
    CLOUDFLARE_ACCOUNT_ID: accountId,
    // Access has account-or-zone endpoints. An inherited zone must not redirect household writes.
    // An explicit empty value also takes precedence over a zone loaded from .env by cf.
    CLOUDFLARE_ZONE_ID: ''
  };
}

export function cfRequestsHelp(args: string[]): boolean {
  return args.some((arg) => /^--help(?:=true)?$|^-[^-]*h/.test(arg));
}

export function parseCfOutput(source: string, args: string[]): unknown {
  if (cfRequestsHelp(args)) return source;
  try {
    const value: unknown = JSON.parse(source);
    return value;
  } catch {
    throw new Error('cf returned unreadable JSON. Check the CLI version before retrying.');
  }
}

/** Run the globally installed npm cf package with Node, avoiding shell quoting on every OS. */
export function globalCfRunner(accountId: string): CfRunner {
  const npmEntry = process.env.npm_execpath;
  if (!npmEntry) throw new Error('Run this command through npm run setup:access-app.');
  const root = spawnSync(process.execPath, [npmEntry, 'root', '--global'], { encoding: 'utf8' });
  if (root.status !== 0) throw new Error('Could not locate global npm tools.');
  const cfEntry = resolve(root.stdout.trim(), 'cf/bin/cf');
  if (!existsSync(cfEntry))
    throw new Error('Install the Cloudflare CLI first: npm install --global cf@1.0.0-beta.12');
  return (args) => {
    const result = spawnSync(process.execPath, [cfEntry, ...args], {
      encoding: 'utf8',
      env: cfResourceEnvironment(accountId),
      maxBuffer: 4 * 1024 * 1024
    });
    if (result.status !== 0)
      throw new Error(
        `cf ${args.slice(0, 4).join(' ')} failed. Check cf auth whoami, the saved account and Zero Trust onboarding. Keep existing resources and rerun after correcting the failure.`
      );
    return parseCfOutput(result.stdout, args);
  };
}

async function main(): Promise<void> {
  try {
    if (process.argv.includes('--help')) {
      console.log(
        'Usage: npm run setup:access-app\nUses cf to identify the saved Worker, create or verify email-code login and exact-email Worker protection, then saves .private/access-setup.json. Requires Zero Trust onboarding and cf auth login.'
      );
      return;
    }
    if (process.argv.length > 2)
      throw new Error('setup:access-app takes no arguments. Use --help.');
    const installation = readInstallationSettings({ required: true });
    if (!installation) throw new Error('Complete setup:config first.');
    if (
      process.env.CLOUDFLARE_ACCOUNT_ID &&
      process.env.CLOUDFLARE_ACCOUNT_ID !== installation.accountId
    )
      throw new Error(
        'CLOUDFLARE_ACCOUNT_ID selects another account. Remove that override before continuing.'
      );
    const file = resolve('.private/access-setup.json');
    const previous = existsSync(file) ? parseAccessSetup(readFileSync(file, 'utf8')) : null;
    if (!process.stdin.isTTY)
      throw new Error(
        'Run setup:access-app in a terminal. Agents can use the documented cf commands to create the same exact application.'
      );
    const { createInterface } = await import('node:readline/promises');
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    try {
      const organiserEmail =
        previous?.organiserEmail ??
        (await prompt.question('Exact email address you will use to sign in: '))
          .trim()
          .toLowerCase();
      const address =
        previous?.hostname ??
        (await prompt.question('Paste the https:// address printed by npm run deploy: ')).trim();
      const url = new URL(address.includes('://') ? address : `https://${address}`);
      if (
        url.protocol !== 'https:' ||
        url.username ||
        url.password ||
        url.port ||
        url.search ||
        url.hash ||
        url.pathname !== '/'
      )
        throw new Error('Use the HTTPS site address only, with no path, credentials or query.');
      const setup = await prepareAccessApplication(
        installation,
        { organiserEmail, hostname: url.hostname },
        globalCfRunner(installation.accountId),
        async (message) =>
          (await prompt.question(`${message} Type yes to continue: `)).trim().toLowerCase() ===
          'yes',
        previous
      );
      if (
        previous &&
        (previous.workerId !== setup.workerId ||
          previous.applicationId !== setup.applicationId ||
          previous.teamDomain !== setup.teamDomain ||
          previous.otpId !== setup.otpId)
      )
        throw new Error(
          'The saved Access setup belongs to different resources. It was not overwritten.'
        );
      mkdirSync(resolve('.private'), { recursive: true, mode: 0o700 });
      if (!previous)
        writeFileSync(file, `${JSON.stringify(setup, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
      console.log(
        'Exact-email Worker protection verified. Settings saved privately. Next: create the scoped Access token, then npm run setup:access -- .private/access-setup.json'
      );
    } finally {
      prompt.close();
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Access application setup failed.');
    process.exitCode = 1;
  }
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) await main();
