import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  INSTALLATION_FILE,
  parseInstallationSettings,
  prepareInstallationConfig,
  readInstallationSettings,
  type InstallationSettings
} from './installation-config.ts';
import type { WranglerRunner } from './check-setup.ts';
import { globalCfRunner, listCfResources } from './setup-access-application.ts';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function setupJson(runner: WranglerRunner, args: string[]): unknown {
  const result = runner(args);
  if (result.status !== 0)
    throw new Error(
      `Could not run wrangler ${args.slice(0, 3).join(' ')}. Check your login and account permissions, then rerun this step.`
    );
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error('Wrangler returned unreadable JSON. No settings were saved.');
  }
}

export async function prepareHousehold(
  input: { accountId: string; workerName: string; databaseName: string },
  runner: WranglerRunner,
  confirm: (message: string) => Promise<boolean>,
  existing: InstallationSettings | null = null
): Promise<InstallationSettings> {
  // Reuse the strict identifier validator before any remote work.
  parseInstallationSettings(
    JSON.stringify({ ...input, databaseId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' })
  );
  if (
    existing &&
    (existing.accountId !== input.accountId ||
      existing.workerName !== input.workerName ||
      existing.databaseName !== input.databaseName)
  ) {
    throw new Error(
      'This folder already belongs to a different installation. Use a separate checkout; the existing settings were not overwritten.'
    );
  }
  const identity = setupJson(runner, ['whoami', '--json']);
  if (
    !record(identity) ||
    !Array.isArray(identity.accounts) ||
    !identity.accounts.some((account: unknown) => record(account) && account.id === input.accountId)
  )
    throw new Error(
      'Wrangler is not signed in to the selected account. Run npx wrangler login for that account.'
    );
  const list = (): Array<{ uuid: string; name: string }> => {
    const value = setupJson(runner, ['d1', 'list', '--json']);
    if (!Array.isArray(value)) throw new Error('Wrangler returned an unreadable database list.');
    return value.map((entry: unknown) => {
      if (!record(entry) || typeof entry.uuid !== 'string' || typeof entry.name !== 'string')
        throw new Error('Wrangler returned an unreadable database list.');
      return { uuid: entry.uuid, name: entry.name };
    });
  };
  let matches = list().filter((database) => database.name === input.databaseName);
  if (matches.length > 1)
    throw new Error(
      'Several databases have the selected name. Resolve the ambiguity before continuing.'
    );
  if (existing) {
    if (matches.length !== 1 || matches[0].uuid !== existing.databaseId)
      throw new Error(
        'The saved database no longer matches Cloudflare. Keep the settings and investigate; no replacement was created.'
      );
    return existing;
  }
  if (matches.length) {
    if (
      !(await confirm(
        `Reuse existing D1 database ${input.databaseName} (${matches[0].uuid}) in account ${input.accountId}?`
      ))
    )
      throw new Error('Stopped without changing the database or saving settings.');
  } else {
    if (!(await confirm(`Create D1 database ${input.databaseName} in account ${input.accountId}?`)))
      throw new Error('Stopped without creating a database.');
    // Disable Wrangler's own config editing. Read the ID back from JSON instead of parsing terminal decoration.
    const result = runner(['d1', 'create', input.databaseName, '--update-config=false']);
    if (result.status !== 0)
      throw new Error(
        'Database creation did not complete. Rerun setup:config to inspect live state before retrying; do not create a second database.'
      );
    matches = list().filter((database) => database.name === input.databaseName);
    if (matches.length !== 1)
      throw new Error(
        'Could not verify the new database. Rerun setup:config; no settings were saved.'
      );
  }
  return parseInstallationSettings(JSON.stringify({ ...input, databaseId: matches[0].uuid }));
}

async function main(): Promise<void> {
  try {
    if (process.argv.includes('--help')) {
      console.log(
        'Usage: npm run setup:config\nChecks your account, creates or explicitly reuses one D1 database, and saves ignored household settings. Rerun to verify an interrupted setup.'
      );
      return;
    }
    if (process.argv.length > 2) throw new Error('setup:config takes no arguments. Use --help.');
    if (process.env.WISHLIST_INSTALLATION !== undefined)
      throw new Error(
        'Remove the WISHLIST_INSTALLATION build override before preparing a local household.'
      );
    if (process.env.CLOUDFLARE_ENV)
      throw new Error(
        'Remove the CLOUDFLARE_ENV override before preparing a local household. No resources were changed.'
      );
    const existing = readInstallationSettings();
    const { createInterface } = await import('node:readline/promises');
    if (!process.stdin.isTTY)
      throw new Error(
        'Run setup:config in a terminal. Agents can instead write the four installation fields documented in docs/INSTALLATION_CONFIG.md.'
      );
    const prompt = createInterface({ input: process.stdin, output: process.stdout });
    try {
      const accountId =
        existing?.accountId ??
        (await prompt.question('Cloudflare account ID (from npx wrangler whoami): ')).trim();
      const workerName =
        existing?.workerName ??
        ((await prompt.question('Choose an unused Worker name [family-wishlist]: ')).trim() ||
          'family-wishlist');
      const databaseName = existing?.databaseName ?? workerName;
      if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_ACCOUNT_ID !== accountId)
        throw new Error(
          'CLOUDFLARE_ACCOUNT_ID selects another account. Remove that override before continuing.'
        );
      if (!existing) {
        parseInstallationSettings(
          JSON.stringify({
            accountId,
            workerName,
            databaseName,
            databaseId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
          })
        );
        const workers = listCfResources(globalCfRunner(accountId), [
          'workers',
          'scripts',
          'search',
          '--name',
          workerName
        ]);
        if (workers.some((worker) => worker.script_name === workerName))
          throw new Error(
            'That Worker name is already in use. Choose an unused name; setup will not overwrite another app. For a resumed deployment, restore its saved household settings first.'
          );
      }
      const runner: WranglerRunner = (args) => {
        const result = spawnSync(
          process.execPath,
          [
            resolve('node_modules/wrangler/bin/wrangler.js'),
            ...args,
            '--config',
            resolve('wrangler.jsonc')
          ],
          {
            encoding: 'utf8',
            env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: accountId, NO_COLOR: '1' }
          }
        );
        return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
      };
      const settings = await prepareHousehold(
        { accountId, workerName, databaseName },
        runner,
        async (message) =>
          (await prompt.question(`${message} Type yes to continue: `)).trim().toLowerCase() ===
          'yes',
        existing
      );
      if (!existing)
        writeFileSync(INSTALLATION_FILE, `${JSON.stringify(settings, null, 2)}\n`, {
          mode: 0o600,
          flag: 'wx'
        });
      prepareInstallationConfig({ required: true });
      console.log(
        'Household settings saved and database identity verified. Next: npm run quality, then npm run audit, then npm run deploy.'
      );
    } finally {
      prompt.close();
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Household setup failed.');
    process.exitCode = 1;
  }
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) await main();
