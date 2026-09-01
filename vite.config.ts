import { reactRouter } from '@react-router/dev/vite';
import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    cloudflare({ remoteBindings: false, viteEnvironment: { name: 'ssr' } }),
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
