import { pathToFileURL } from 'node:url';
import { readInstallationSettings } from './installation-config.ts';
import { cfRequestsHelp, globalCfRunner } from './setup-access-application.ts';

export function installationCfArgs(args: string[]): string[] {
  const supported =
    args[0] === 'zero-trust' ||
    args[0] === 'd1' ||
    (args[0] === 'workers' && args[1] === 'scripts' && args[2] === 'search') ||
    args[0] === 'schema' ||
    (args[0] === 'cli' && args[1] === 'search');
  if (
    !supported ||
    args.some((arg) => /^--(?:zone|profile|local|mode)(?:=|$)|^-[^-]*[zm]/.test(arg))
  ) {
    throw new Error(
      'Use this wrapper for account-scoped D1 and Zero Trust resource commands or Worker discovery. Account/profile overrides and project deployment commands are not supported.'
    );
  }
  return args;
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  try {
    const args = process.argv.slice(2);
    if (!args.length || (args.length === 1 && cfRequestsHelp(args))) {
      console.log(
        'Usage: npm run installation:cf -- <resource command>\nRuns the globally installed cf with this household account explicitly selected. Use npm run deploy for this Wrangler project.'
      );
    } else {
      const installation = readInstallationSettings({ required: true });
      if (!installation) throw new Error('Complete setup:config first.');
      if (
        process.env.CLOUDFLARE_ACCOUNT_ID &&
        process.env.CLOUDFLARE_ACCOUNT_ID !== installation.accountId
      )
        throw new Error(
          'CLOUDFLARE_ACCOUNT_ID selects another account. Remove that override before continuing.'
        );
      const result = globalCfRunner(installation.accountId)(installationCfArgs(args));
      console.log(cfRequestsHelp(args) ? result : JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Cloudflare command failed.');
    process.exitCode = 1;
  }
}
