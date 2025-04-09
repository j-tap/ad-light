import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { version } from './package.json';

export default defineConfig({
  root: './',
  base: './',
  build: {
    outDir: 'dist'
  },
  define: {
    __APP_VERSION__: JSON.stringify(version),
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
