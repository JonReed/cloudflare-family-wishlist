import { describe, expect, it } from 'vitest';
import manifest from '../package.json';

describe('production release commands', () => {
  it('requires migrations to succeed before deploying, preserving Worker variables', () => {
    expect(manifest.scripts['deploy:production']).toBe(
      'npm run db:migrate:remote && wrangler deploy --keep-vars'
    );
    expect(manifest.scripts['db:migrate:remote']).toBe('wrangler d1 migrations apply DB --remote');
  });
  it('builds before a manual release and keeps ordinary builds free of remote mutations', () => {
    expect(manifest.scripts.deploy).toBe('npm run build && npm run deploy:production');
    expect(manifest.scripts.build).toBe('react-router build');
  });
});
