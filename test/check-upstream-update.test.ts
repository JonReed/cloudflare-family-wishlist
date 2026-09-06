import { describe, expect, it, vi } from 'vitest';

import {
  applyUpstreamUpdate,
  checkUpstreamUpdate,
  parseUpdateConfiguration,
  type UpdateConfiguration
} from '../scripts/check-upstream-update';

const previous = 'a'.repeat(40);
const latest = 'b'.repeat(40);
const config: UpdateConfiguration = {
  repository: 'example/wishlist',
  channel: 'stable',
  enabled: true,
  commit: previous
};

function gitRunner(head = latest) {
  return vi.fn((args: string[]) => ({
    status: 0,
    stdout: args[0] === 'rev-parse' ? head : ''
  }));
}

describe('installation update configuration', () => {
  it('reads an explicit channel and full commit pin', () => {
    expect(
      parseUpdateConfiguration(JSON.stringify(config), JSON.stringify({ commit: previous }))
    ).toEqual(config);
  });

  it.each([
    { repository: 'https://github.com/example/wishlist' },
    { repository: 'example/../wishlist' },
    { repository: 'example/wishlist\n' },
    { channel: 'latest' },
    { channel: ['main'] },
    { enabled: 'true' },
    { enabled: undefined }
  ])('rejects ambiguous or invalid settings', (override) => {
    expect(() =>
      parseUpdateConfiguration(
        JSON.stringify({ ...config, ...override }),
        JSON.stringify({ commit: previous })
      )
    ).toThrow();
  });

  it.each(['main', previous + '\n', '', '--help'])('rejects invalid pinned commit %s', (commit) => {
    expect(() =>
      parseUpdateConfiguration(JSON.stringify(config), JSON.stringify({ commit }))
    ).toThrow();
  });

  it('rejects malformed JSON', () => {
    expect(() => parseUpdateConfiguration('{', '{}')).toThrow('valid JSON');
  });
});

describe('upstream update check', () => {
  it('does not access GitHub when updates are disabled', () => {
    const git = gitRunner();
    expect(checkUpstreamUpdate({ ...config, enabled: false }, git)).toEqual({
      status: 'disabled',
      commit: previous
    });
    expect(git).not.toHaveBeenCalled();
  });

  it.each(['stable', 'main'] as const)(
    'fetches only the chosen %s channel without upstream credentials',
    (channel) => {
      const git = gitRunner();
      expect(checkUpstreamUpdate({ ...config, channel }, git)).toEqual({
        status: 'available',
        previousCommit: previous,
        commit: latest
      });
      expect(git).toHaveBeenCalledWith([
        '-c',
        'http.https://github.com/.extraheader=',
        '-c',
        'credential.helper=',
        'fetch',
        '--no-tags',
        'https://github.com/example/wishlist.git',
        `refs/heads/${channel}`
      ]);
      expect(git).toHaveBeenLastCalledWith(['merge-base', '--is-ancestor', previous, latest]);
    }
  );

  it('leaves an unchanged installation alone', () => {
    expect(checkUpstreamUpdate(config, gitRunner(previous))).toEqual({
      status: 'current',
      commit: previous
    });
  });

  it('fails closed when the public upstream cannot be fetched', () => {
    const git = vi.fn(() => ({ status: 128, stdout: 'private diagnostic' }));
    expect(() => checkUpstreamUpdate(config, git)).toThrow('Could not fetch');
    expect(git).toHaveBeenCalledTimes(1);
  });

  it('rejects downgrades and unrelated histories', () => {
    const git = gitRunner();
    git.mockImplementation((args) => ({
      status: args[0] === 'merge-base' ? 1 : 0,
      stdout: latest
    }));
    expect(() => checkUpstreamUpdate(config, git)).toThrow('downgrade');
  });

  it('rejects an invalid fetched commit', () => {
    expect(() => checkUpstreamUpdate(config, gitRunner('main'))).toThrow('invalid commit');
  });
});

describe('applying an installation update', () => {
  const decision = { status: 'available', previousCommit: previous, commit: latest } as const;

  it('writes and commits only the version pin, using an ordinary push', () => {
    const git = gitRunner();
    const write = vi.fn();
    expect(applyUpstreamUpdate(decision, git, write)).toBe(true);
    expect(write).toHaveBeenCalledExactlyOnceWith(
      `${JSON.stringify({ commit: latest }, null, 2)}\n`
    );
    expect(git).toHaveBeenCalledWith(['add', '--', 'app-version.json']);
    expect(git).toHaveBeenLastCalledWith(['push', 'origin', 'HEAD:refs/heads/main']);
  });

  it.each(['current', 'disabled'] as const)('does not write or commit for %s', (status) => {
    const git = gitRunner();
    const write = vi.fn();
    expect(applyUpstreamUpdate({ status, commit: previous }, git, write)).toBe(false);
    expect(write).not.toHaveBeenCalled();
    expect(git).not.toHaveBeenCalled();
  });

  it('preserves an installation with uncommitted local edits', () => {
    const git = vi.fn(() => ({ status: 0, stdout: ' M installation.json' }));
    const write = vi.fn();
    expect(() => applyUpstreamUpdate(decision, git, write)).toThrow('local changes');
    expect(write).not.toHaveBeenCalled();
  });

  it('stops after a rejected concurrent push without forcing or retrying', () => {
    const git = gitRunner();
    git.mockImplementation((args) => ({ status: args[0] === 'push' ? 1 : 0, stdout: '' }));
    expect(() => applyUpstreamUpdate(decision, git, vi.fn())).toThrow('Could not push');
    expect(git.mock.calls.filter(([args]) => args[0] === 'push')).toHaveLength(1);
  });
});
