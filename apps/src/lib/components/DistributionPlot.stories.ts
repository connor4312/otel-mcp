import type { Meta, StoryObj } from '@storybook/svelte';
import DistributionPlot from './DistributionPlot.svelte';

const meta = {
  title: 'Components/DistributionPlot',
  component: DistributionPlot,
  tags: ['autodocs'],
} satisfies Meta<DistributionPlot>;

export default meta;
type Story = StoryObj<typeof meta>;

export const NormalDistribution: Story = {
  args: {
    durations: [12, 15, 18, 20, 22, 24, 25, 26, 28, 30, 32, 35, 40, 45, 120],
    currentMs: 45,
    minMs: 12,
    maxMs: 120,
    avgMs: 31.5,
    p50Ms: 25,
    p95Ms: 45,
    thisRank: 13,
    count: 15,
  },
};

export const OutlierSpan: Story = {
  args: {
    durations: [5, 6, 6, 7, 7, 8, 8, 8, 9, 10, 250],
    currentMs: 250,
    minMs: 5,
    maxMs: 250,
    avgMs: 29.5,
    p50Ms: 8,
    p95Ms: 250,
    thisRank: 11,
    count: 11,
  },
};

export const TightCluster: Story = {
  args: {
    durations: [100, 101, 102, 103, 104, 105],
    currentMs: 103,
    minMs: 100,
    maxMs: 105,
    avgMs: 102.5,
    p50Ms: 102,
    p95Ms: 105,
    thisRank: 4,
    count: 6,
  },
};
