import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export type GitResult = { status: number | null; stdout: string };
export type GitRunner = (args: string[]) => GitResult;
export type ReleaseTarget = { tag: string; sha: string };

export function validateReleaseVersions(
  target: ReleaseTarget,
  manifestSource: string,
  lockSource: string
): void {
  const manifest: unknown = JSON.parse(manifestSource);
  const lock: unknown = JSON.parse(lockSource);
  const object = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);
  const expected = target.tag.slice(1);
  if (
    !object(manifest) ||
    manifest.version !== expected ||
    !object(lock) ||
    lock.version !== expected ||
    !object(lock.packages) ||
    !object(lock.packages['']) ||
    lock.packages[''].version !== expected
  ) {
    throw new Error('The release tag, package version and lockfile versions must agree.');
  }
}

export function readReleaseTarget(event: unknown, sha: string): ReleaseTarget {
  if (typeof event !== 'object' || event === null || !('release' in event)) {
    throw new Error('A published GitHub release is required.');
  }
  const release = event.release;
  if (
    !('action' in event) ||
    event.action !== 'published' ||
    typeof release !== 'object' ||
    release === null ||
    !('draft' in release) ||
    release.draft !== false ||
    !('prerelease' in release) ||
    release.prerelease !== false ||
    !('tag_name' in release) ||
    typeof release.tag_name !== 'string' ||
    release.tag_name.trim() !== release.tag_name ||
    !/^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(release.tag_name)
  ) {
    throw new Error('Only published stable releases named vMAJOR.MINOR.PATCH can advance stable.');
  }
  if (sha.length !== 40 || !/^[0-9a-f]{40}$/.test(sha))
    throw new Error('The release commit SHA is invalid.');
  return { tag: release.tag_name, sha };
}

export function promoteRelease(
  target: ReleaseTarget,
  checkOnly: boolean,
  git: GitRunner = (args) => {
    const result = spawnSync('git', args, { encoding: 'utf8' });
    return { status: result.status, stdout: result.stdout ?? '' };
  }
): 'checked' | 'unchanged' | 'promoted' {
  function run(args: string[]): string {
    const result = git(args);
    if (result.status !== 0) {
      // Do not echo Git output: authenticated remote URLs can contain credentials.
      throw new Error(
        `Git ${args[0]} failed; stable was not force-updated. Check repository access and branch rules.`
      );
    }
    return result.stdout.trim();
  }

  if (run(['rev-parse', 'HEAD']) !== target.sha) {
    throw new Error('The checkout does not match the release commit.');
  }
  run(['fetch', '--no-tags', 'origin', `refs/tags/${target.tag}`]);
  if (run(['rev-parse', 'FETCH_HEAD^{commit}']) !== target.sha) {
    throw new Error('The release tag no longer matches the checked commit.');
  }
  run(['fetch', '--no-tags', 'origin', 'refs/heads/main']);
  run(['merge-base', '--is-ancestor', target.sha, 'FETCH_HEAD']);

  const stable = git(['ls-remote', '--exit-code', '--heads', 'origin', 'refs/heads/stable']);
  if (stable.status === 0) {
    run(['fetch', '--no-tags', 'origin', 'refs/heads/stable']);
    const previous = run(['rev-parse', 'FETCH_HEAD']);
    if (previous === target.sha) return 'unchanged';
    if (git(['merge-base', '--is-ancestor', previous, target.sha]).status !== 0) {
      throw new Error('Refusing to move stable backwards or onto a different history.');
    }
  } else if (stable.status !== 2) {
    throw new Error('Could not check the remote stable branch.');
  }

  if (checkOnly) return 'checked';
  // A normal push checks ancestry again on the server if another release wins the race.
  run(['push', 'origin', `${target.sha}:refs/heads/stable`]);
  return 'promoted';
}

function main(): void {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 1 || !['--check', '--promote'].includes(args[0])) {
      throw new Error('Use --check or --promote.');
    }
    if (process.env.GITHUB_EVENT_NAME !== 'release' || !process.env.GITHUB_EVENT_PATH) {
      throw new Error('Run this script from the GitHub release workflow.');
    }
    const target = readReleaseTarget(
      JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')),
      process.env.GITHUB_SHA ?? ''
    );
    validateReleaseVersions(
      target,
      readFileSync('package.json', 'utf8'),
      readFileSync('package-lock.json', 'utf8')
    );
    console.log(`Release ${target.tag}: ${promoteRelease(target, args[0] === '--check')}.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Release promotion failed.');
    process.exitCode = 1;
  }
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  main();
}
