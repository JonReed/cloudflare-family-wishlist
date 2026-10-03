import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { prepareInstallationConfig } from './installation-config.ts';

export function installationWranglerArgs(args: string[], configPath: string): string[] {
  if (!args.length) throw new Error('Supply a Wrangler command.');
  if (args.some((arg) => /^--(?:config|env)(?:=|$)|^-[^-]*[ce]/.test(arg))) {
    throw new Error(
      'Choose an installation through its settings, not a config or environment override.'
    );
  }
  return [...args, '--config', configPath];
}

export function runWrangler(args: string[]): void {
  const invocation = wranglerInvocation(args);
  const result = spawnSync(invocation.executable, invocation.args, {
    stdio: 'inherit',
    env: process.env
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`Wrangler failed (${result.status ?? result.signal ?? 'unknown'}).`);
}

/** Node cannot exec Windows .cmd files directly. Launch the installed JS entry on every OS. */
export function wranglerInvocation(args: string[], directory = process.cwd()) {
  return {
    executable: process.execPath,
    args: [resolve(directory, 'node_modules/wrangler/bin/wrangler.js'), ...args]
  };
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
