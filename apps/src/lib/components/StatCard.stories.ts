import type { Meta, StoryObj } from '@storybook/svelte';
import StatCard from './StatCard.svelte';

const meta = {
  title: 'Components/StatCard',
  component: StatCard,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'error', 'ok', 'warn'],
    },
  },
} satisfies Meta<StatCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { label: 'Traces', value: '1,234' },
};

export const ErrorVariant: Story = {
  args: { label: 'Error Rate', value: '12.5%', variant: 'error' },
};

export const OkVariant: Story = {
  args: { label: 'Error Rate', value: '0.3%', variant: 'ok' },
};

export const WarnVariant: Story = {
  args: { label: 'Rank', value: '95/100', variant: 'warn' },
};

export const Numeric: Story = {
  args: { label: 'Spans', value: 42689 },
};

export const Latency: Story = {
  args: { label: 'p99 Latency', value: '2.45s' },
};
