import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';
import { resolve } from 'path';

// Dev-mode config: serves all pages for local development
export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      '$lib': resolve(import.meta.dirname!, 'src/lib')
    }
  },
  root: 'src',
  build: {
    rollupOptions: {
      input: {
        'select-source': resolve(import.meta.dirname!, 'src/pages/select-source/index.html'),
        'trace-dashboard': resolve(import.meta.dirname!, 'src/pages/trace-dashboard/index.html'),
        'trace-detail': resolve(import.meta.dirname!, 'src/pages/trace-detail/index.html'),
        'span-breakdown': resolve(import.meta.dirname!, 'src/pages/span-breakdown/index.html'),
      }
    }
  }
});
