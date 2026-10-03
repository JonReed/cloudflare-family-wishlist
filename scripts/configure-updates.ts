import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import { automaticUpdateSecret, parseAutomaticUpdateConfig } from '../app/lib/updates/config.ts';
import { checkSetup } from './check-setup.ts';
import { prepareInstallationConfig, readInstallationSettings } from './installation-config.ts';
import { wranglerInvocation } from './installation-wrangler.ts';
import { privateTokenPrompt } from './private-token-prompt.ts';

export async function verifyUpdateWorkflow(repository: string, token: string): Promise<void> {
  parseAutomaticUpdateConfig(JSON.stringify({ repository, token }));
  let response: Response;
  try {
    response = await fetch(
      `https://api.github.com/repos/${repository}/actions/workflows/update-household.yml`,
      {
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': '2026-03-10'
        }
      }
    );
  } catch {
    throw new Error('Could not check GitHub. Check your connection and retry updates:configure.');
  }
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error(
      `GitHub workflow check failed (HTTP ${response.status}). Check the repository, enabled workflow and token permissions.`
    );
  }
  let workflow: unknown;
  try {
    workflow = await response.json();
  } catch {
    throw new Error('GitHub returned an unreadable workflow. Retry updates:configure.');
  }
  if (
    typeof workflow !== 'object' ||
    workflow === null ||
    !('state' in workflow) ||
    workflow.state !== 'active' ||
    !('path' in workflow) ||
    workflow.path !== '.github/workflows/update-household.yml'
  )
    throw new Error(
      'Enable Update Family Wishlist in your own repository before saving the update key.'
    );
  // Also verify write permission and the new workflow inputs before storing the key.
  let dispatched: Response;
  try {
    dispatched = await fetch(
      `https://api.github.com/repos/${repository}/actions/workflows/update-household.yml/dispatches`,
      {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-GitHub-Api-Version': '2026-03-10'
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: { automatic: true, scheduled_time: 'setup-check' }
        })
      }
    );
  } catch {
    throw new Error('Could not start the setup check. Retry updates:configure.');
  }
  await dispatched.body?.cancel().catch(() => undefined);
  if (dispatched.status !== 200 && dispatched.status !== 204)
    throw new Error(
      `GitHub update-start check failed (HTTP ${dispatched.status}). Use the current released workflow and give the token Actions read/write permission.`
    );
}

async function main(): Promise<void> {
  let token = '';
  try {
    const args = process.argv.slice(2);
    if (args[0] === '--help') {
      console.log(
        'Usage: npm run updates:configure -- OWNER/REPOSITORY\nChecks the existing installation and GitHub workflow, then saves the scoped GitHub key privately on that Worker. Follow docs/AUTOMATIC_UPDATES.md.'
      );
      return;
    }
    if (args.length !== 1)
      throw new Error('Supply your own GitHub OWNER/REPOSITORY. Use --help for the command.');
    const repository = args[0];
    // Reject an invalid target before asking for a credential or contacting either service.
    parseAutomaticUpdateConfig(
      JSON.stringify({ repository, token: `github_pat_${'x'.repeat(20)}` })
    );
    const installation = readInstallationSettings({ required: true });
    if (!installation) throw new Error('Installation settings are missing.');
    const configPath = prepareInstallationConfig({ required: true });
    await checkSetup(
      installation,
      (args) => {
        const invocation = wranglerInvocation([...args, '--config', configPath]);
        const result = spawnSync(invocation.executable, invocation.args, {
          encoding: 'utf8',
          env: process.env
        });
        return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
      },
      {},
      undefined,
      { beforeLogin: true }
    );
    token =
      process.env.WISHLIST_GITHUB_TOKEN ??
      (await privateTokenPrompt(
        'fine-grained GitHub token',
        'updates:configure',
        'WISHLIST_GITHUB_TOKEN'
      ));
    await verifyUpdateWorkflow(repository, token);
    const invocation = wranglerInvocation(['secret', 'bulk', '--config', configPath]);
    const result = spawnSync(invocation.executable, invocation.args, {
      encoding: 'utf8',
      env: process.env,
      input: JSON.stringify({ [automaticUpdateSecret]: JSON.stringify({ repository, token }) })
    });
    if (result.error || result.status !== 0)
      throw new Error(
        'Could not save the update key on the existing Worker. Check Wrangler login and retry.'
      );
    console.log(
      `Update key saved on ${installation.workerName}. Next: verify the Cloudflare timer and its automatic run using docs/AUTOMATIC_UPDATES.md. A saved key is not proof that an update completed.`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Update configuration failed.';
    console.error(token ? message.replaceAll(token, '[redacted]') : message);
    process.exitCode = 1;
  }
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) await main();
