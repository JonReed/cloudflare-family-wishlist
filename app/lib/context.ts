import { createContext } from 'react-router';

import type { AccessEnv, AuthenticatedIdentity } from './auth/access';
import type { AccessManagementEnv } from './cloudflare/access-membership';

export type OrganiserBootstrapEnv = {
  INITIAL_ORGANISER_EMAIL?: string;
};

export type RuntimeEnv = Env & AccessEnv & AccessManagementEnv & OrganiserBootstrapEnv;

export type CloudflareContext = {
  env: RuntimeEnv;
  ctx: ExecutionContext;
  cspNonce: string;
};

export const cloudflareContext = createContext<CloudflareContext>();
export const identityContext = createContext<AuthenticatedIdentity>();

export function organiserEmailForRequest(
  env: OrganiserBootstrapEnv,
  authenticatedEmail: string
): string | undefined {
  return env.INITIAL_ORGANISER_EMAIL ?? (import.meta.env.DEV ? authenticatedEmail : undefined);
}
