import type { Config } from '@react-router/dev/config';

export default {
  ssr: true,
  // The Worker entry supplies the development exception or the deployment's
  // explicit public hostname at runtime. Keep the build default fail-closed.
  allowedActionOrigins: []
} satisfies Config;
