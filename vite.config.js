import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'public',
  publicDir: false,
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'public/index.html'),
      },
    },
    assetsInlineLimit: 4096,
    cssCodeSplit: true,
    sourcemap: false,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  preview: {
    port: 4173,
  },
});
