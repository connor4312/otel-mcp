import type { Meta, StoryObj } from '@storybook/svelte';
import StatusMessage from './StatusMessage.svelte';

const meta = {
  title: 'Components/StatusMessage',
  component: StatusMessage,
  tags: ['autodocs'],
  argTypes: {
    type: { control: 'select', options: ['error', 'success', 'loading'] },
  },
} satisfies Meta<StatusMessage>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  args: { type: 'loading', message: 'Loading traces…' },
};

export const Success: Story = {
  args: { type: 'success', message: 'Loaded 1,247 lines with 3,891 spans from /var/log/traces.jsonl. You can close this tab.' },
};

export const Error: Story = {
  args: { type: 'error', message: 'SCP failed: Connection timed out after 15 seconds.' },
};
