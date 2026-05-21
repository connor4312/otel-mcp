<script lang="ts">
  interface Props {
    label: string;
    value: string | number;
    variant?: 'default' | 'error' | 'ok' | 'warn';
  }

  let { label, value, variant = 'default' }: Props = $props();
</script>

<div class="stat-card">
  <div class="stat-label">{label}</div>
  <div class="stat-value {variant}">{value}</div>
</div>

<style>
  .stat-card {
    background: var(--color-background-secondary);
    border: 1px solid var(--color-border-primary);
    border-radius: var(--border-radius-md, 8px);
    padding: 10px 14px;
  }

  .stat-label {
    font-size: 0.7rem;
    color: var(--color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .stat-value {
    font-size: 1.25rem;
    font-weight: 700;
    margin-top: 2px;
  }

  .stat-value.error { color: var(--color-text-danger); }
  .stat-value.ok { color: var(--color-text-success); }
  .stat-value.warn { color: var(--color-text-warning); }
</style>
