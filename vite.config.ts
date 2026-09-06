import { reactRouter } from '@react-router/dev/vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { prepareInstallationConfig } from './scripts/installation-config.ts';

export default defineConfig({
  plugins: [
    cloudflare({
      configPath: prepareInstallationConfig(),
      remoteBindings: false,
      viteEnvironment: { name: 'ssr' }
    }),
    tailwindcss(),
    reactRouter()
  ],
  resolve: {
    tsconfigPaths: true
  },
  build: {
    rollupOptions: {
      output: {
        assetFileNames(assetInfo) {
          const isStylesheet = assetInfo.names.some((name) => name.endsWith('.css'));
          return isStylesheet
            ? 'shared-assets/[name]-[hash][extname]'
            : 'assets/[name]-[hash][extname]';
        }
      }
    }
  }
});
