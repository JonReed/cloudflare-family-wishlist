import { describe, expect, it, vi } from 'vitest';

import { promoteRelease, readReleaseTarget, type GitResult } from '../scripts/promote-release';

const sha = 'a'.repeat(40);
const previous = 'b'.repeat(40);
const target = { tag: 'v1.2.0', sha };
const event = {
  action: 'published',
  release: { tag_name: target.tag, draft: false, prerelease: false }
};

function runner(overrides: Record<string, GitResult> = {}) {
  const results: Record<string, GitResult> = {
    'rev-parse HEAD': { status: 0, stdout: sha },
    'rev-parse FETCH_HEAD^{commit}': { status: 0, stdout: sha },
    'rev-parse FETCH_HEAD': { status: 0, stdout: previous },
    ...overrides
  };
  return vi.fn((args: string[]) => results[args.join(' ')] ?? { status: 0, stdout: '' });
}

function expectNoPush(git: ReturnType<typeof runner>) {
  expect(git.mock.calls.some(([args]) => args[0] === 'push')).toBe(false);
}

describe('release eligibility', () => {
  it('accepts a published stable version and exact commit', () => {
    expect(readReleaseTarget(event, sha)).toEqual(target);
  });

  it.each([
    null,
    {},
    { ...event, action: 'edited' },
    { ...event, release: { ...event.release, draft: true } },
    { ...event, release: { ...event.release, prerelease: true } },
    { ...event, release: { tag_name: target.tag } },
    ...['main', 'v1.0.0-rc.1', 'v01.0.0', 'v1.2', '--help', 'v1.2.3\n'].map((tag_name) => ({
      ...event,
      release: { ...event.release, tag_name }
    }))
  ])('rejects an ineligible event', (input) => {
    expect(() => readReleaseTarget(input, sha)).toThrow();
  });

  it('rejects invalid commit identifiers', () => {
    expect(() => readReleaseTarget(event, 'main')).toThrow('SHA');
    expect(() => readReleaseTarget(event, sha + '\n')).toThrow('SHA');
  });
});

describe('stable promotion', () => {
  it('pushes exactly the tested commit without force', () => {
    const git = runner();
    expect(promoteRelease(target, false, git)).toBe('promoted');
    expect(git).toHaveBeenLastCalledWith(['push', 'origin', `${sha}:refs/heads/stable`]);
    expect(git).toHaveBeenCalledWith(['merge-base', '--is-ancestor', sha, 'FETCH_HEAD']);
    expect(git).toHaveBeenCalledWith(['merge-base', '--is-ancestor', previous, sha]);
  });

  it('creates stable on the first release', () => {
    const git = runner({
      'ls-remote --exit-code --heads origin refs/heads/stable': { status: 2, stdout: '' }
    });
    expect(promoteRelease(target, false, git)).toBe('promoted');
    expect(git).toHaveBeenLastCalledWith(['push', 'origin', `${sha}:refs/heads/stable`]);
  });

  it('does not push in check mode', () => {
    const git = runner();
    expect(promoteRelease(target, true, git)).toBe('checked');
    expectNoPush(git);
  });

  it('does nothing when rerunning the current release', () => {
    const git = runner({ 'rev-parse FETCH_HEAD': { status: 0, stdout: sha } });
    expect(promoteRelease(target, false, git)).toBe('unchanged');
    expectNoPush(git);
  });

  it.each([
    ['rev-parse HEAD', { status: 0, stdout: previous }],
    ['rev-parse FETCH_HEAD^{commit}', { status: 0, stdout: previous }],
    ['fetch --no-tags origin refs/heads/main', { status: 128, stdout: 'private output' }],
    [`merge-base --is-ancestor ${sha} FETCH_HEAD`, { status: 1, stdout: '' }],
    [`merge-base --is-ancestor ${previous} ${sha}`, { status: 1, stdout: '' }],
    ['ls-remote --exit-code --heads origin refs/heads/stable', { status: 128, stdout: '' }]
  ] as const)('stops before any write when %s fails validation', (command, result) => {
    const git = runner({ [command]: result });
    expect(() => promoteRelease(target, false, git)).toThrow();
    expectNoPush(git);
  });

  it('reports a rejected concurrent push without retrying or exposing Git output', () => {
    const git = runner({
      [`push origin ${sha}:refs/heads/stable`]: { status: 1, stdout: 'secret-token' }
    });
    expect(() => promoteRelease(target, false, git)).toThrow('Git push failed');
    expect(git.mock.calls.filter(([args]) => args[0] === 'push')).toHaveLength(1);
  });
});
