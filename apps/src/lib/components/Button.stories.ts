import type { Meta, StoryObj } from '@storybook/svelte';
import ButtonStory from './ButtonStory.svelte';

const meta = {
  title: 'Components/Button',
  component: ButtonStory,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['default', 'primary', 'sm'] },
  },
} satisfies Meta<ButtonStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { label: '🔍 Analyze Traces' },
};

export const Primary: Story = {
  args: { label: '🧪 Deep Analysis', variant: 'primary' },
};

export const Small: Story = {
  args: { label: '🔍 Inspect this span', variant: 'sm' },
};

export const Disabled: Story = {
  args: { label: '⏳ Analyzing…', variant: 'primary', disabled: true },
};

export const Secondary: Story = {
  args: { label: '📥 Export JSON' },
};
