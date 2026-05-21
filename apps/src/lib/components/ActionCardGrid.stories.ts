import type { Meta, StoryObj } from '@storybook/svelte';
import ActionCardGrid from './ActionCardGrid.svelte';

const meta = {
  title: 'Components/ActionCardGrid',
  component: ActionCardGrid,
  tags: ['autodocs'],
} satisfies Meta<ActionCardGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    actions: [
      { id: 'explain', icon: '💡', title: 'Explain This Span', desc: 'Ask the model what this span does and why it took this long' },
      { id: 'bottleneck', icon: '🐌', title: 'Find Bottlenecks', desc: 'Identify which child spans contribute most to latency' },
      { id: 'compare', icon: '📊', title: 'Compare Similar Spans', desc: 'Compare with 12 other "db.query" spans across all traces' },
      { id: 'chain', icon: '🔗', title: 'Analyze Call Chain', desc: 'Examine the full ancestry from root to this span' },
      { id: 'errors', icon: '🚨', title: 'Error Analysis', desc: 'Check for errors in this span and its descendants' },
      { id: 'optimize', icon: '⚡', title: 'Suggest Optimizations', desc: 'Get concrete suggestions to reduce duration' },
    ],
    onaction: (id: string) => console.log('Action:', id),
  },
};

export const TwoCards: Story = {
  args: {
    actions: [
      { id: 'retry', icon: '🔄', title: 'Retry', desc: 'Retry the failed operation' },
      { id: 'skip', icon: '⏭️', title: 'Skip', desc: 'Skip and continue' },
    ],
    onaction: (id: string) => console.log('Action:', id),
  },
};
