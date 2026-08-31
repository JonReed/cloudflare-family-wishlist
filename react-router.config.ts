import type { Config } from '@react-router/dev/config';

export default {
  ssr: true,
  // The Worker entry adds loopback hosts only in development. Production
  // mutation requests must match the request origin exactly.
  allowedActionOrigins: []
} satisfies Config;
