import { resolve, join } from 'path';
import type { StorybookConfig } from '@storybook/svelte-vite';

const config: StorybookConfig = {
  stories: ['../src/**/*.stories.@(ts|svelte)'],
  addons: ['@storybook/addon-essentials'],
  framework: {
    name: '@storybook/svelte-vite',
    options: {},
  },
  viteFinal(config) {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
      '$lib': join(process.cwd(), 'src/lib'),
    };
    return config;
  },
};

export default config;
