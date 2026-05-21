import type { Meta, StoryObj } from '@storybook/svelte';
import Badge from './Badge.svelte';

const meta = {
  title: 'Components/Badge',
  component: Badge,
  tags: ['autodocs'],
  argTypes: {
    type: { control: 'select', options: ['err', 'ok'] },
  },
} satisfies Meta<Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const OK: Story = {
  args: { type: 'ok' },
};

export const Error: Story = {
  args: { type: 'err' },
};

export const CustomText: Story = {
  args: { type: 'err', text: '3 errors' },
};
