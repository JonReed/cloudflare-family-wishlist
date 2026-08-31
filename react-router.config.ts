import type { Config } from '@react-router/dev/config';

export default {
  ssr: true,
  // The Worker entry adds a development-only proxy exception. Production
  // mutation requests must remain same-origin.
  allowedActionOrigins: []
} satisfies Config;
