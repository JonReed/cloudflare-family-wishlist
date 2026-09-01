import { pathToFileURL } from 'node:url';

import {
  ensurePublicSharingAccess,
  type PublicSharingAccessResult
} from '../app/lib/cloudflare/access-public-sharing';

function configuredHostnames(env: NodeJS.ProcessEnv = process.env, args = process.argv.slice(2)) {
  const values = args.length > 0 ? args : (env.WISHLIST_PUBLIC_HOSTNAMES ?? '').split(',');
  const hostnames = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  if (hostnames.length === 0) {
    throw new Error(
      'Pass at least one production hostname, or set WISHLIST_PUBLIC_HOSTNAMES to a comma-separated list.'
    );
  }
  return hostnames;
}

export async function configureAccessSharing(
  env: NodeJS.ProcessEnv = process.env,
  args = process.argv.slice(2),
  configure: (
    environment: NodeJS.ProcessEnv,
    hostname: string
  ) => Promise<PublicSharingAccessResult> = ensurePublicSharingAccess
) {
  const results = [];
  for (const hostname of configuredHostnames(env, args)) {
    results.push(await configure(env, hostname));
  }
  return results;
}

async function main(): Promise<void> {
  try {
    const results = await configureAccessSharing();
    for (const result of results) {
      console.log(
        `${result.created ? 'Created' : 'Confirmed'} narrow public sharing access for ${result.hostname}.`
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown setup failure.';
    console.error(`Could not configure public sharing: ${message}`);
    process.exitCode = 1;
  }
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  await main();
}
