import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import { prepareInstallationConfig } from './installation-config.ts';

export function installationWranglerArgs(args: string[], configPath: string): string[] {
  if (!args.length) throw new Error('Supply a Wrangler command.');
  if (args.some((arg) => /^(?:-c|--config|-e|--env)(?:=|$)/.test(arg))) {
    throw new Error(
      'Choose an installation through its settings, not a config or environment override.'
    );
  }
  return [...args, '--config', configPath];
}

export function runWrangler(args: string[]): void {
  const result = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['--no-install', 'wrangler', ...args],
    {
      stdio: 'inherit',
      env: process.env
    }
  );
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`Wrangler failed (${result.status ?? result.signal ?? 'unknown'}).`);
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  try {
    const args = process.argv.slice(2);
    // The dedicated local migration command remains usable without installation credentials.
    const localMigration = args.join(' ') === 'd1 migrations apply DB --local';
    const configPath = prepareInstallationConfig({ required: !localMigration });
    runWrangler(installationWranglerArgs(args, configPath));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Wrangler command failed.');
    process.exitCode = 1;
  }
}
