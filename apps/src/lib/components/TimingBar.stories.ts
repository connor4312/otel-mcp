import type { Meta, StoryObj } from '@storybook/svelte';
import TimingBar from './TimingBar.svelte';

const meta = {
  title: 'Components/TimingBar',
  component: TimingBar,
  tags: ['autodocs'],
} satisfies Meta<TimingBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MostlySelf: Story = {
  args: { selfPct: 85, selfMs: 425, childrenMs: 75 },
};

export const MostlyChildren: Story = {
  args: { selfPct: 12, selfMs: 24, childrenMs: 176 },
};

export const EvenSplit: Story = {
  args: { selfPct: 50, selfMs: 100, childrenMs: 100 },
};

export const AllSelf: Story = {
  args: { selfPct: 100, selfMs: 342.5, childrenMs: 0 },
};
