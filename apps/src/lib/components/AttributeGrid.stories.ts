import type { Meta, StoryObj } from '@storybook/svelte';
import AttributeGrid from './AttributeGrid.svelte';

const meta = {
  title: 'Components/AttributeGrid',
  component: AttributeGrid,
  tags: ['autodocs'],
} satisfies Meta<AttributeGrid>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    attributes: {
      'http.method': 'GET',
      'http.url': 'https://api.example.com/v1/users?page=2',
      'http.status_code': '200',
      'http.response_content_length': '4521',
      'net.peer.name': 'api.example.com',
      'net.peer.port': '443',
    },
  },
};

export const DatabaseSpan: Story = {
  args: {
    attributes: {
      'db.system': 'postgresql',
      'db.name': 'users_db',
      'db.statement': 'SELECT id, name, email FROM users WHERE active = true LIMIT 100',
      'db.operation': 'SELECT',
    },
  },
};

export const Empty: Story = {
  args: { attributes: {} },
};
