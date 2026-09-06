import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { prepareInstallationConfig } from './installation-config.ts';

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function compareDeployedCommit(
  expected: string,
  deployment: unknown,
  readVersion: (id: string) => unknown
): { current: boolean; versions: { id: string; percentage: number; commit: string | null }[] } {
  if (expected.length !== 40 || !/^[a-f0-9]{40}$/.test(expected))
    throw new Error('Supply the full desired application commit SHA.');
  if (!object(deployment) || !Array.isArray(deployment.versions))
    throw new Error('No readable current deployment.');
  const versions = deployment.versions
    .map((version: unknown) => {
      if (
        !object(version) ||
        typeof version.version_id !== 'string' ||
        version.version_id.length !== 36 ||
        !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
          version.version_id
        ) ||
        typeof version.percentage !== 'number' ||
        !Number.isFinite(version.percentage) ||
        version.percentage < 0 ||
        version.percentage > 100
      ) {
        throw new Error('Unreadable deployment traffic assignment.');
      }
      return { id: version.version_id, percentage: version.percentage };
    })
    .filter((version) => version.percentage > 0)
    .map((version) => {
      const info = readVersion(version.id);
      const annotations = object(info) && object(info.annotations) ? info.annotations : {};
      const tag = annotations['workers/tag'];
      return {
        ...version,
        commit:
          typeof tag === 'string' && tag.length === 40 && /^[a-f0-9]{40}$/.test(tag) ? tag : null
      };
    });
  if (
    !versions.length ||
    Math.abs(versions.reduce((sum, version) => sum + version.percentage, 0) - 100) > 0.001
  ) {
    throw new Error('Deployment traffic does not account for 100 percent.');
  }
  return { current: versions.every((version) => version.commit === expected), versions };
}

const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  try {
    if (
      process.argv.length !== 3 ||
      process.argv[2].length !== 40 ||
      !/^[a-f0-9]{40}$/.test(process.argv[2])
    )
      throw new Error('Supply the full desired application commit SHA.');
    const config = prepareInstallationConfig({ required: true });
    const read = (args: string[]): unknown => {
      const result = spawnSync(
        process.platform === 'win32' ? 'npx.cmd' : 'npx',
        ['--no-install', 'wrangler', ...args, '--config', config, '--json'],
        { encoding: 'utf8', timeout: 60_000 }
      );
      if (result.error || result.status !== 0)
        throw new Error(
          'Could not read deployment status. Check Wrangler authentication and account access.'
        );
      return JSON.parse(result.stdout);
    };
    const result = compareDeployedCommit(process.argv[2], read(['deployments', 'status']), (id) =>
      read(['versions', 'view', id])
    );
    console.log(JSON.stringify({ expected: process.argv[2], ...result }, null, 2));
    if (!result.current) process.exitCode = 1;
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : 'Could not verify the live application version.'
    );
    process.exitCode = 1;
  }
}
