import type { Config } from '@react-router/dev/config';

export default {
  ssr: true,
  // Keep mutation requests same-origin. React Router also validates action origins by default.
  allowedActionOrigins: []
} satisfies Config;
