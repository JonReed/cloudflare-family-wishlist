import path from 'node:path';

import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(import.meta.dirname, 'migrations'));

  return {
    plugins: [
      cloudflareTest({
        // Workers AI has no local simulator. Product extraction injects a fake
        // in unit tests, so the test pool must never open a remote AI session.
        remoteBindings: false,
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          bindings: { TEST_MIGRATIONS: migrations }
        }
      })
    ],
    test: {
      include: ['test/**/*.test.{ts,tsx}'],
      setupFiles: ['./test/apply-migrations.ts'],
      coverage: {
        reporter: ['text', 'html'],
        reportsDirectory: './coverage'
      }
    }
  };
});
