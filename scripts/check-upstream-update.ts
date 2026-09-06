import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

type GitResult = { status: number | null; stdout: string };
export type UpdateGitRunner = (args: string[]) => GitResult;
export type UpdateConfiguration = {
  repository: string;
  channel: 'main' | 'stable';
  enabled: boolean;
  commit: string;
};
export type UpdateDecision =
  | { status: 'disabled' | 'current'; commit: string }
  | { status: 'available'; previousCommit: string; commit: string };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseUpdateConfiguration(source: string, version: string): UpdateConfiguration {
  let config: unknown;
  let pinned: unknown;
  try {
    config = JSON.parse(source);
    pinned = JSON.parse(version);
  } catch {
    throw new Error('updater.json and app-version.json must contain valid JSON.');
  }
  if (
    !record(config) ||
    typeof config.repository !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(config.repository) ||
    config.repository.trim() !== config.repository ||
    (config.channel !== 'main' && config.channel !== 'stable') ||
    typeof config.enabled !== 'boolean'
  ) {
    throw new Error(
      'updater.json requires a GitHub owner/repository, main or stable, and enabled.'
    );
  }
  if (
    !record(pinned) ||
    typeof pinned.commit !== 'string' ||
    pinned.commit.length !== 40 ||
    !/^[a-f0-9]{40}$/.test(pinned.commit)
  ) {
    throw new Error('app-version.json must pin a full Git commit SHA.');
  }
  return {
    repository: config.repository,
    channel: config.channel,
    enabled: config.enabled,
    commit: pinned.commit
  };
}

function gitResult(git: UpdateGitRunner, args: string[], failure: string): string {
  const result = git(args);
  // Git errors can contain authenticated remote URLs. Report the operation, not its raw output.
  if (result.status !== 0) throw new Error(failure);
  return result.stdout.trim();
}

export function checkUpstreamUpdate(
  config: UpdateConfiguration,
  git: UpdateGitRunner
): UpdateDecision {
  if (!config.enabled) return { status: 'disabled', commit: config.commit };
  gitResult(
    git,
    [
      '-c',
      'http.https://github.com/.extraheader=',
      '-c',
      'credential.helper=',
      'fetch',
      '--no-tags',
      `https://github.com/${config.repository}.git`,
      `refs/heads/${config.channel}`
    ],
    'Could not fetch the public upstream channel. The installed version was not changed.'
  );
  const commit = gitResult(
    git,
    ['rev-parse', 'FETCH_HEAD'],
    'Could not resolve the upstream commit.'
  );
  if (commit.length !== 40 || !/^[a-f0-9]{40}$/.test(commit)) {
    throw new Error('Upstream returned an invalid commit SHA.');
  }
  if (commit === config.commit) return { status: 'current', commit };
  gitResult(
    git,
    ['merge-base', '--is-ancestor', config.commit, commit],
    'Refusing an automatic downgrade or different upstream history. Review channel compatibility first.'
  );
  return { status: 'available', previousCommit: config.commit, commit };
}

export function applyUpstreamUpdate(
  decision: UpdateDecision,
  git: UpdateGitRunner,
  writeVersion: (content: string) => void
): boolean {
  if (decision.status !== 'available') return false;
  const dirty = gitResult(
    git,
    ['status', '--porcelain'],
    'Could not check the installation checkout.'
  );
  if (dirty)
    throw new Error('The installation checkout has local changes; refusing to overwrite them.');
  writeVersion(`${JSON.stringify({ commit: decision.commit }, null, 2)}\n`);
  const commands = [
    ['config', 'user.name', 'github-actions[bot]'],
    ['config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'],
    ['add', '--', 'app-version.json'],
    ['commit', '-m', `Update application to ${decision.commit.slice(0, 12)}`],
    ['push', 'origin', 'HEAD:refs/heads/main']
  ];
  for (const args of commands) {
    gitResult(
      git,
      args,
      `Could not ${args[0]} the update. Retry from a fresh installation checkout.`
    );
  }
  return true;
}

function main(): void {
  try {
    const mode = process.argv[2];
    if (process.argv.length !== 3 || !['--check', '--apply'].includes(mode)) {
      throw new Error('Use --check or --apply from an installation repository.');
    }
    const config = parseUpdateConfiguration(
      readFileSync('updater.json', 'utf8'),
      readFileSync('app-version.json', 'utf8')
    );
    const git: UpdateGitRunner = (args) => {
      const result = spawnSync('git', args, {
        encoding: 'utf8',
        timeout: 120_000,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
      });
      return { status: result.status, stdout: result.stdout ?? '' };
    };
    const decision = checkUpstreamUpdate(config, git);
    const applied =
      mode === '--apply' &&
      applyUpstreamUpdate(decision, git, (content) => writeFileSync('app-version.json', content));
    console.log(JSON.stringify({ ...decision, applied }));
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'The update check failed.');
    process.exitCode = 1;
  }
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) main();
