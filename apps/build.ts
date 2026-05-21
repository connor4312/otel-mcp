// Build script: builds each page separately as a self-contained HTML file.
// Uses vite-plugin-singlefile to inline all CSS/JS into each HTML.

import { build } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pages = ['select-source', 'trace-dashboard', 'trace-detail', 'span-breakdown', 'pick-span-detail'];

for (const page of pages) {
  console.log(`\nBuilding ${page}...`);
  await build({
    configFile: false,
    root: resolve(__dirname, 'src/pages', page),
    plugins: [
      svelte({
        compilerOptions: {
          css: 'injected'
        }
      }),
      viteSingleFile()
    ],
    resolve: {
      alias: {
        '$lib': resolve(__dirname, 'src/lib')
      }
    },
    build: {
      outDir: resolve(__dirname, 'build', page),
      emptyOutDir: true,
      minify: true,
    }
  });
}

console.log('\nAll pages built successfully.');
