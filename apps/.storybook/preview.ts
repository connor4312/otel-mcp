import type { Preview } from '@storybook/svelte';

import './theme.css';

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0f1117' },
        { name: 'light', value: '#ffffff' },
      ],
    },
  },
  decorators: [],
};

export default preview;
