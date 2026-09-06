import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { parseUpdateConfiguration } from './check-upstream-update.ts';
import { readInstallationSettings, type InstallationSettings } from './installation-config.ts';

export const INSTALLER_PROTOCOL = 1;
const receiptFile = '.wishlist-build.json';
export type BuildReceipt = {
  protocol: number;
  repository: string;
  commit: string;
  directory: string;
  installation: string;
};

export function installationFingerprint(settings: InstallationSettings): string {
  return createHash('sha256').update(JSON.stringify(settings)).digest('hex');
}

/** Public source and dependencies do not need the build system's deployment credentials. */
export function buildEnvironment(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const allowed = [
    'PATH',
    'HOME',
    'USERPROFILE',
    'SystemRoot',
    'COMSPEC',
    'TMPDIR',
    'TEMP',
    'TMP',
    'CI',
    'LANG',
    'LC_ALL',
    'NODE_EXTRA_CA_CERTS'
  ];
  return Object.fromEntries(allowed.flatMap((key) => (env[key] ? [[key, env[key]]] : [])));
}

export function validateBuildReceipt(
  receipt: unknown,
  expected: { repository: string; commit: string; settings: InstallationSettings }
): BuildReceipt {
  if (
    typeof receipt !== 'object' ||
    receipt === null ||
    !('protocol' in receipt) ||
    receipt.protocol !== INSTALLER_PROTOCOL ||
    !('repository' in receipt) ||
    receipt.repository !== expected.repository ||
    !('commit' in receipt) ||
    receipt.commit !== expected.commit ||
    !('installation' in receipt) ||
    receipt.installation !== installationFingerprint(expected.settings) ||
    !('directory' in receipt) ||
    typeof receipt.directory !== 'string' ||
    receipt.directory.trim() !== receipt.directory ||
    !/^\.application-[A-Za-z0-9]+$/.test(receipt.directory)
  )
    throw new Error(
      'No matching successful build. Run the installation build again before deploying.'
    );
  return receipt as BuildReceipt;
}

function command(
  file: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  operation = `${file} ${args[0]}`
): string {
  const result = spawnSync(file, args, { cwd, env, encoding: 'utf8', timeout: 600_000 });
  // Git and package-manager failures can include credential-bearing URLs. Do not echo raw output.
  if (result.error || result.status !== 0)
    throw new Error(`${operation} failed in the installation build.`);
  return result.stdout.trim();
}

export function runInstallation(mode: '--build' | '--deploy', root = process.cwd()): void {
  const config = parseUpdateConfiguration(
    readFileSync(resolve(root, 'updater.json'), 'utf8'),
    readFileSync(resolve(root, 'app-version.json'), 'utf8')
  );
  const settings = readInstallationSettings({ directory: root, required: true });
  if (!settings) throw new Error('Installation settings are required.');
  const receiptPath = resolve(root, receiptFile);
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const env = {
    ...buildEnvironment(process.env),
    GIT_TERMINAL_PROMPT: '0',
    WISHLIST_INSTALLATION: JSON.stringify(settings)
  };
  if (mode === '--build') {
    // A failed rebuild must not leave an earlier successful build deployable by this wrapper.
    if (existsSync(receiptPath)) unlinkSync(receiptPath);
    const directoryPath = mkdtempSync(resolve(root, '.application-'));
    command('git', ['init', '--quiet'], directoryPath, env);
    command(
      'git',
      [
        '-c',
        'credential.helper=',
        '-c',
        'http.https://github.com/.extraheader=',
        'fetch',
        '--depth=1',
        '--no-tags',
        `https://github.com/${config.repository}.git`,
        config.commit
      ],
      directoryPath,
      env,
      'Fetching the pinned public application source'
    );
    command('git', ['checkout', '--detach', 'FETCH_HEAD'], directoryPath, env);
    if (command('git', ['rev-parse', 'HEAD'], directoryPath, env) !== config.commit) {
      throw new Error('Fetched source does not match the pinned commit.');
    }
    console.log(`Building ${config.repository} at ${config.commit}.`);
    command(npm, ['ci'], directoryPath, env);
    command(npm, ['run', 'build'], directoryPath, env);
    const receipt: BuildReceipt = {
      protocol: INSTALLER_PROTOCOL,
      repository: config.repository,
      commit: config.commit,
      directory: directoryPath.slice(resolve(root).length + 1),
      installation: installationFingerprint(settings)
    };
    writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + '\n', { mode: 0o600 });
    console.log('Build complete. Nothing has been deployed.');
    return;
  }
  const receipt = validateBuildReceipt(JSON.parse(readFileSync(receiptPath, 'utf8')), {
    repository: config.repository,
    commit: config.commit,
    settings
  });
  const directoryPath = resolve(root, receipt.directory);
  if (command('git', ['rev-parse', 'HEAD'], directoryPath, env) !== config.commit) {
    throw new Error('The built checkout changed. Rebuild before deploying.');
  }
  // Only deployment receives the operator's credentials. The application validates its built target.
  const result = spawnSync(npm, ['run', 'deploy:production'], {
    cwd: directoryPath,
    stdio: 'inherit',
    timeout: 600_000,
    env: {
      ...process.env,
      WISHLIST_INSTALLATION: JSON.stringify(settings),
      WISHLIST_RELEASE_COMMIT: config.commit
    }
  });
  if (result.error || result.status !== 0)
    throw new Error(
      'Deployment failed. Review the Cloudflare build log; do not roll back SQL automatically.'
    );
  console.log(
    `Deployment command succeeded for ${config.commit}. Confirm the live version and application checks.`
  );
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  try {
    const mode = process.argv[2];
    if (process.argv.length !== 3 || (mode !== '--build' && mode !== '--deploy'))
      throw new Error('Use --build or --deploy.');
    runInstallation(mode);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Installation command failed.');
    process.exitCode = 1;
  }
}
