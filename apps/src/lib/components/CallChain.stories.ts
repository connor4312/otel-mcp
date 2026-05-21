import type { Meta, StoryObj } from '@storybook/svelte';
import CallChain from './CallChain.svelte';

const meta = {
  title: 'Components/CallChain',
  component: CallChain,
  tags: ['autodocs'],
} satisfies Meta<CallChain>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    items: [
      { name: 'gateway.request', serviceName: 'api-gateway' },
      { name: 'auth.verify', serviceName: 'auth-service' },
      { name: 'user.lookup', serviceName: 'user-service' },
    ],
    current: 'db.query',
  },
};

export const SingleAncestor: Story = {
  args: {
    items: [{ name: 'http.request', serviceName: 'web-server' }],
    current: 'db.connect',
  },
};

export const Long: Story = {
  args: {
    items: [
      { name: 'ingress', serviceName: 'load-balancer' },
      { name: 'route', serviceName: 'api-gateway' },
      { name: 'authenticate', serviceName: 'auth' },
      { name: 'authorize', serviceName: 'rbac' },
      { name: 'fetch-user', serviceName: 'user-svc' },
      { name: 'cache-lookup', serviceName: 'redis' },
    ],
    current: 'db.select',
  },
};
