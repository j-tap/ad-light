import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { version } from './package.json';

export default defineConfig({
  root: './',
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        // Engine code changes far less often than game code, so it is cached separately.
        manualChunks: {
          phaser: ['phaser'],
        },
      },
    },
  },
  server: {
    port: 5917,
    strictPort: true,
  },
  preview: {
    port: 5918,
    strictPort: true,
  },
  define: {
    __APP_VERSION__: JSON.stringify(version),
    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
  },
  plugins: [
    viteStaticCopy({
      targets: [
        {
          src: 'assets',
          dest: ''
        }
      ]
    })
  ]
});
