import { spawnSync } from 'node:child_process';
import { appendFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const upstreamRepository = 'JonReed/cloudflare-family-wishlist';
const markerPath = '.wishlist-upstream.json';
const productPaths = ['.', ':(exclude).github', `:(exclude)${markerPath}`];
const fullSha = /^[a-f0-9]{40}$/;
const heartbeatInterval = 28 * 24 * 60 * 60 * 1000;

export type ForkUpdateResult = {
  status: 'current' | 'ahead' | 'available' | 'updated' | 'heartbeat';
  sourceCommit: string;
  deploymentCommit?: string;
};

/** Only public, gate-passed stable source is copied. Household workflows stay local. */
export function updateFork({
  root = process.cwd(),
  upstream = `https://github.com/${upstreamRepository}.git`,
  apply = false,
  forceBuild = false,
  now = Date.now()
}: {
  root?: string;
  upstream?: string;
  apply?: boolean;
  forceBuild?: boolean;
  now?: number;
} = {}): ForkUpdateResult {
  const git = (args: string[], input?: string, allowFailure = false) => {
    const result = spawnSync('git', args, {
      cwd: root,
      input,
      encoding: 'utf8',
      timeout: 120_000,
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' }
    });
    if (result.error || (!allowFailure && result.status !== 0)) {
      // Git diagnostics may contain authenticated URLs. Never print them.
      throw new Error(
        `Git ${args[0]} failed. Nothing was force-pushed. Check access and retry from a fresh checkout.`
      );
    }
    return { status: result.status, output: result.stdout ?? '' };
  };
  const sha = (value: string) => {
    const trimmed = value.trim();
    if (!fullSha.test(trimmed))
      throw new Error('Invalid upstream commit. No update was published.');
    return trimmed;
  };
  if (git(['status', '--porcelain']).output) {
    throw new Error(
      'The checkout has local changes. Commit or move them before running the updater.'
    );
  }
  if (git(['branch', '--show-current']).output.trim() !== 'main') {
    throw new Error('Run the updater on the household repository’s main branch.');
  }
  const head = sha(git(['rev-parse', 'HEAD']).output);
  const fetch = (branch: string) => {
    git([
      '-c',
      'credential.helper=',
      '-c',
      'http.https://github.com/.extraheader=',
      'fetch',
      '--no-tags',
      upstream,
      `refs/heads/${branch}`
    ]);
    return sha(git(['rev-parse', 'FETCH_HEAD']).output);
  };
  const latestMain = fetch('main');
  const stable = fetch('stable');
  const ancestor = (older: string, newer: string) => {
    const result = git(['merge-base', '--is-ancestor', older, newer], undefined, true);
    if (result.status !== 0 && result.status !== 1)
      throw new Error('Could not verify upstream history.');
    return result.status === 0;
  };
  if (!ancestor(stable, latestMain))
    throw new Error('The stable release is outside upstream main. Refusing the update.');

  const marker = git(['show', `HEAD:${markerPath}`], undefined, true);
  let baseline: string;
  if (marker.status === 0) {
    const value: unknown = JSON.parse(marker.output);
    if (
      typeof value !== 'object' ||
      value === null ||
      !('commit' in value) ||
      typeof value.commit !== 'string' ||
      !fullSha.test(value.commit) ||
      !('protocol' in value) ||
      value.protocol !== 1
    ) {
      throw new Error('The saved upstream version is invalid. Repair it before updating.');
    }
    baseline = value.commit;
    // Snapshot commits do not retain upstream ancestry. Fetch the saved object explicitly.
    git([
      '-c',
      'credential.helper=',
      '-c',
      'http.https://github.com/.extraheader=',
      'fetch',
      '--no-tags',
      upstream,
      baseline
    ]);
  } else {
    baseline = sha(git(['merge-base', head, latestMain]).output);
  }
  if (!ancestor(baseline, latestMain))
    throw new Error('The installed source is outside upstream history. Refusing the update.');
  const customised = git(
    ['diff', '--quiet', baseline, head, '--', ...productPaths],
    undefined,
    true
  );
  if (customised.status !== 0) {
    throw new Error(
      'This fork contains application or configuration changes. Preserve them and follow docs/UPDATES.md before enabling automatic updates. No files were replaced.'
    );
  }
  let status: ForkUpdateResult['status'];
  let target: string;
  if (stable === baseline) {
    status = 'current';
    target = baseline;
  } else if (ancestor(stable, baseline)) {
    // A repair from main can be ahead of the last release. Never downgrade it.
    status = 'ahead';
    target = baseline;
  } else if (ancestor(baseline, stable)) {
    status = 'available';
    target = stable;
  } else {
    throw new Error('The next release is on a different history. Refusing an automatic downgrade.');
  }
  if (!apply) return { status, sourceCommit: target };

  const lastActivity = Number(git(['log', '-1', '--format=%ct']).output.trim()) * 1000;
  const keepAlive = forceBuild || marker.status !== 0 || now - lastActivity >= heartbeatInterval;
  if (status !== 'available' && !keepAlive)
    return { status, sourceCommit: target, deploymentCommit: head };
  if (status === 'available') {
    const patch = git(['diff', '--binary', baseline, target, '--', ...productPaths]).output;
    if (patch) git(['apply', '--index', '--binary', '-'], patch);
  }
  writeFileSync(
    resolve(root, markerPath),
    JSON.stringify(
      {
        protocol: 1,
        commit: target,
        checkedAt: new Date(now).toISOString()
      },
      null,
      2
    ) + '\n'
  );
  git(['add', '--', markerPath]);
  git([
    '-c',
    'user.name=github-actions[bot]',
    '-c',
    'user.email=41898282+github-actions[bot]@users.noreply.github.com',
    'commit',
    '-m',
    status === 'available'
      ? `Update Family Wishlist to ${target.slice(0, 12)}`
      : 'Keep Family Wishlist updates active'
  ]);
  const deploymentCommit = sha(git(['rev-parse', 'HEAD']).output);
  // A concurrent owner push must reject this normal push, never overwrite their work.
  git(['push', 'origin', 'HEAD:refs/heads/main']);
  return {
    status: status === 'available' ? 'updated' : 'heartbeat',
    sourceCommit: target,
    deploymentCommit
  };
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  try {
    const mode = process.argv[2];
    if (process.argv.length !== 3 || !['--check', '--apply'].includes(mode))
      throw new Error('Use --check or --apply.');
    if (
      mode === '--apply' &&
      (!process.env.GITHUB_REPOSITORY ||
        process.env.GITHUB_REPOSITORY.toLowerCase() === upstreamRepository.toLowerCase())
    ) {
      throw new Error('Automatic publishing is only allowed in a household GitHub repository.');
    }
    const result = updateFork({
      apply: mode === '--apply',
      forceBuild:
        process.env.GITHUB_EVENT_NAME === 'workflow_dispatch' &&
        process.env.WISHLIST_AUTOMATIC_CHECK !== 'true'
    });
    console.log(JSON.stringify(result));
    if (process.env.GITHUB_OUTPUT)
      appendFileSync(
        process.env.GITHUB_OUTPUT,
        `deployment_commit=${result.deploymentCommit ?? ''}\nsource_commit=${result.sourceCommit}\n`
      );
    if (process.env.GITHUB_STEP_SUMMARY)
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `## Family Wishlist update\n\nSource: \`${result.sourceCommit}\`\n\nResult: **${result.status}**. A Git push is not proof of a successful Cloudflare deployment.\n`
      );
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'The update failed.');
    process.exitCode = 1;
  }
}
