import { createContext } from 'react-router';

import type { AccessEnv, AuthenticatedIdentity } from './auth/access';
import type { AccessManagementEnv } from './cloudflare/access-membership';

export type RuntimeEnv = Env & AccessEnv & AccessManagementEnv;

export type CloudflareContext = {
  env: RuntimeEnv;
  ctx: ExecutionContext;
  cspNonce: string;
};

export const cloudflareContext = createContext<CloudflareContext>();
export const identityContext = createContext<AuthenticatedIdentity>();
