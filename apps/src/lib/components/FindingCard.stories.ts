import type { Meta, StoryObj } from '@storybook/svelte';
import FindingCard from './FindingCard.svelte';

const meta = {
  title: 'Components/FindingCard',
  component: FindingCard,
  tags: ['autodocs'],
  argTypes: {
    severity: { control: 'select', options: ['critical', 'warning', 'info'] },
  },
} satisfies Meta<FindingCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Critical: Story = {
  args: {
    severity: 'critical',
    title: 'High Error Rate in auth-service',
    detail: 'auth-service has a 23% error rate across 450 spans — significantly above the 5% threshold.',
  },
};

export const Warning: Story = {
  args: {
    severity: 'warning',
    title: 'Slow p99 on database queries',
    detail: 'db.query spans have p99 of 850ms (avg 45ms). Investigate outliers.',
  },
};

export const WarningWithExample: Story = {
  args: {
    severity: 'warning',
    title: 'Slow p99 on database queries',
    detail: 'db.query spans have p99 of 850ms (avg 45ms). Investigate outliers.',
    exampleSpan: {
      traceId: 'abc123def456',
      spanId: 'span789',
      name: 'db.query SELECT users',
      serviceName: 'user-service',
      durationMs: 923.45,
    },
  },
};

export const CriticalWithExample: Story = {
  args: {
    severity: 'critical',
    title: 'High Error Rate in auth-service',
    detail: 'auth-service has a 23% error rate across 450 spans — significantly above the 5% threshold.',
    exampleSpan: {
      traceId: 'trace001',
      spanId: 'span001',
      name: 'POST /auth/login',
      serviceName: 'auth-service',
      durationMs: 2340.12,
    },
  },
};

export const Info: Story = {
  args: {
    severity: 'info',
    title: 'Service dependency chain',
    detail: 'gateway → auth → user-db forms the longest critical path at 1.2s.',
  },
};
