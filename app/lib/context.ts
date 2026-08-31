import { createContext } from 'react-router';

import type { AccessEnv, AuthenticatedIdentity } from './auth/access';

export type RuntimeEnv = Env & AccessEnv;

export type CloudflareContext = {
  env: RuntimeEnv;
  ctx: ExecutionContext;
  cspNonce: string;
};

export const cloudflareContext = createContext<CloudflareContext>();
export const identityContext = createContext<AuthenticatedIdentity>();
