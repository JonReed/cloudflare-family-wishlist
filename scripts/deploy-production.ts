import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { parseSetupConfiguration } from './check-setup.ts';
import {
  prepareInstallationConfig,
  readInstallationSettings,
  type InstallationSettings
} from './installation-config.ts';
import { runWrangler } from './installation-wrangler.ts';

export function verifyBuiltInstallation(source: string, installation: InstallationSettings): void {
  const built = parseSetupConfiguration(source);
  for (const key of ['accountId', 'workerName', 'databaseId', 'databaseName'] as const) {
    if (built[key] !== installation[key]) {
      throw new Error(
        `The build targets a different ${key}. Rebuild with the intended installation settings before deploying.`
      );
    }
  }
}

export function deployProduction(
  installation: InstallationSettings,
  builtSource: string,
  sourceConfig: string,
  builtConfig: string,
  runner: (args: string[]) => void = runWrangler,
  releaseCommit?: string
): void {
  verifyBuiltInstallation(builtSource, installation);
  if (
    releaseCommit !== undefined &&
    (releaseCommit.length !== 40 || !/^[a-f0-9]{40}$/.test(releaseCommit))
  ) {
    throw new Error('The application release commit must be a full SHA.');
  }
  // A failed migration must stop the deployment. A deployed Worker is never rolled back automatically.
  runner(['d1', 'migrations', 'apply', 'DB', '--remote', '--config', sourceConfig]);
  runner([
    'deploy',
    '--config',
    builtConfig,
    '--keep-vars',
    ...(releaseCommit ? ['--tag', releaseCommit] : [])
  ]);
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  try {
    if (process.argv.length > 2)
      throw new Error('The production deployment command accepts no arguments.');
    const installation = readInstallationSettings({ required: true });
    if (!installation) throw new Error('Installation settings are required.');
    const sourceConfig = prepareInstallationConfig({ required: true });
    const builtConfig = resolve('build/server/wrangler.json');
    deployProduction(
      installation,
      readFileSync(builtConfig, 'utf8'),
      sourceConfig,
      builtConfig,
      runWrangler,
      process.env.WISHLIST_RELEASE_COMMIT
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Production deployment failed.');
    process.exitCode = 1;
  }
}
