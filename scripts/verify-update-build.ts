import { spawnSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { setTimeout } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

type BuildCheck = {
  id: number;
  name: string;
  app: string;
  status: string;
  conclusion: string | null;
};

export function cloudflareBuildState(
  checks: BuildCheck[]
): 'missing' | 'pending' | 'failed' | 'success' {
  const latest = new Map<string, BuildCheck>();
  for (const check of checks) {
    if (check.app !== 'cloudflare-workers-and-pages' || !check.name.startsWith('Workers Builds:'))
      continue;
    if (check.id > (latest.get(check.name)?.id ?? -1)) latest.set(check.name, check);
  }
  const builds = [...latest.values()];
  if (!builds.length) return 'missing';
  if (builds.some((build) => build.status !== 'completed')) return 'pending';
  return builds.every((build) => build.conclusion === 'success') ? 'success' : 'failed';
}

async function main() {
  const repository = process.env.GITHUB_REPOSITORY ?? '';
  const commit = process.env.UPDATE_COMMIT ?? '';
  if (!/^[A-Za-z0-9-]+\/[A-Za-z0-9_.-]+$/.test(repository) || !/^[a-f0-9]{40}$/.test(commit)) {
    throw new Error('A household repository and full deployment commit are required.');
  }
  const started = Date.now();
  while (Date.now() - started < 25 * 60_000) {
    const result = spawnSync(
      'gh',
      [
        'api',
        `repos/${repository}/commits/${commit}/check-runs?per_page=100`,
        '--jq',
        '[.check_runs[] | {id,name,app:.app.slug,status,conclusion}]'
      ],
      { encoding: 'utf8', timeout: 30_000 }
    );
    if (result.error || result.status !== 0)
      throw new Error(
        'Could not read build checks. Open your Worker’s Builds page to verify the deployment.'
      );
    const state = cloudflareBuildState(JSON.parse(result.stdout) as BuildCheck[]);
    if (state === 'success') {
      console.log(`Cloudflare successfully built and deployed repository commit ${commit}.`);
      if (process.env.GITHUB_STEP_SUMMARY)
        appendFileSync(
          process.env.GITHUB_STEP_SUMMARY,
          `\nCloudflare build: **successful** for \`${commit}\`. This confirms the deployment command succeeded; it does not replace sign-in and application checks.\n`
        );
      return;
    }
    if (state === 'failed')
      throw new Error(
        'Cloudflare rejected this build. Open Workers & Pages → your Worker → Builds, fix the reported cause, then retry that build. The update is not complete.'
      );
    if (state === 'missing' && Date.now() - started > 180_000) {
      throw new Error(
        'No Cloudflare build appeared. Connect this repository’s main branch to the existing Worker, disable build watch-path filters, then run this workflow again. See docs/REPAIR_UPDATES.md.'
      );
    }
    await setTimeout(15_000);
  }
  throw new Error(
    'Cloudflare has not confirmed deployment within 25 minutes. Open its Builds page; do not assume the update succeeded.'
  );
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  main().catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : 'Could not verify the Cloudflare build.';
    console.error(message);
    if (process.env.GITHUB_STEP_SUMMARY)
      appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n**Update needs attention:** ${message}\n`);
    process.exitCode = 1;
  });
}
