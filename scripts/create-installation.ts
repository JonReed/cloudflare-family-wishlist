import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseUpdateConfiguration } from './check-upstream-update.ts';

export function createInstallation(directory: string, commit: string, channel: string): void {
  const updater = { repository: 'JonReed/cloudflare-family-wishlist', channel, enabled: true };
  parseUpdateConfiguration(JSON.stringify(updater), JSON.stringify({ commit }));
  const destination = resolve(directory);
  // Intentionally refuse existing paths; never merge into or replace somebody's repository.
  mkdirSync(destination);
  mkdirSync(resolve(destination, 'scripts'));
  mkdirSync(resolve(destination, '.github/workflows'), { recursive: true });
  const source = dirname(fileURLToPath(import.meta.url));
  for (const name of [
    'check-upstream-update.ts',
    'build-installation.ts',
    'installation-config.ts',
    'jsonc.ts'
  ]) {
    writeFileSync(resolve(destination, 'scripts', name), readFileSync(resolve(source, name)));
  }
  const writeJson = (name: string, value: unknown) =>
    writeFileSync(resolve(destination, name), JSON.stringify(value, null, 2) + '\n');
  writeJson('updater.json', updater);
  writeJson('app-version.json', { commit });
  writeJson('installer-version.json', { protocol: 1 });
  writeJson('package.json', {
    name: 'family-wishlist-installation',
    private: true,
    type: 'module',
    engines: { node: '>=22.22.0' },
    scripts: {
      build: 'node scripts/build-installation.ts --build',
      deploy: 'node scripts/build-installation.ts --deploy'
    }
  });
  writeFileSync(
    resolve(destination, '.gitignore'),
    '.application-*/\n.wishlist-build.json\n.wishlist-installation.json\nnode_modules/\n'
  );
  writeFileSync(
    resolve(destination, '.github/workflows/update.yml'),
    `name: Check upstream updates
on:
  workflow_dispatch:
  schedule:
    - cron: '23 */6 * * *'
permissions:
  contents: write
concurrency:
  group: automatic-updates
  cancel-in-progress: false
jobs:
  update:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7
        with:
          ref: main
          fetch-depth: 0
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7
        with:
          node-version: '24'
      - run: node scripts/check-upstream-update.ts --apply
`
  );
  writeFileSync(
    resolve(destination, 'README.md'),
    `# Family Wishlist installation

This repository pins application source without copying it into your household's repository.
Create a private GitHub repository from these files, on main. Authorise Cloudflare Builds for it.
Configure build command \`npm run build\` and deploy command \`npm run deploy\`, with previews disabled.
Set the complete \`WISHLIST_INSTALLATION\` build variable before connecting it to the intended Worker.
The Worker must already have its D1 database, Access configuration and runtime secrets set up.

\`updater.json\` selects main/stable and enables or disables updates. \`app-version.json\` is a desired
commit, not proof of a live deployment. Check Cloudflare Builds and the Worker version tag after
updates. For a failed build, correct the cause and use Cloudflare's Retry build control; there are
no unbounded retry loops or automatic database rollbacks. GitHub's updater can also be run manually.

Installer protocol 1 files are maintained separately from application source. Review installer fixes
in upstream release notes; generate a new installation in an empty temporary directory and compare
the scripts/workflow before applying an installer update. Preserve your configuration and version pin.
Do not blindly replace this repository with upstream files.

Read https://github.com/JonReed/cloudflare-family-wishlist/blob/main/docs/INSTALLATION_UPDATES.md
for current validation status, setup instructions and limitations before relying on automatic updates.
`
  );
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  try {
    if (process.argv.length !== 5)
      throw new Error(
        'Use: node scripts/create-installation.ts NEW_DIRECTORY FULL_COMMIT main|stable'
      );
    createInstallation(process.argv[2], process.argv[3], process.argv[4]);
    console.log(
      'Installation files created. No repository, Cloudflare resource or deployment was changed.'
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Could not create installation files.');
    process.exitCode = 1;
  }
}
