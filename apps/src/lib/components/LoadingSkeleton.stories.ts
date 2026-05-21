import type { Meta, StoryObj } from '@storybook/svelte';
import LoadingSkeleton from './LoadingSkeleton.svelte';

const meta = {
  title: 'Components/LoadingSkeleton',
  component: LoadingSkeleton,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: ['card', 'line'] },
  },
} satisfies Meta<LoadingSkeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CardGrid: Story = {
  args: { count: 4, variant: 'card' },
};

export const TableLines: Story = {
  args: { count: 5, variant: 'line' },
};

export const TwoCards: Story = {
  args: { count: 2, variant: 'card' },
};
