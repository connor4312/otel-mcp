<script lang="ts">
  interface ChainItem {
    name: string;
    serviceName: string;
  }

  interface Props {
    items: ChainItem[];
    current: string;
  }

  let { items, current }: Props = $props();
</script>

<div class="chain">
  {#each items as c}
    <span class="chain-item" title={c.serviceName}>{c.name}</span>
    <span class="chain-arrow">→</span>
  {/each}
  <span class="chain-item current">{current}</span>
</div>

<style>
  .chain {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    align-items: center;
  }

  .chain-item {
    background: var(--color-background-secondary);
    border: 1px solid var(--color-border-primary);
    border-radius: 6px;
    padding: 4px 10px;
    font-size: 0.78rem;
    font-family: var(--font-mono);
  }

  .chain-item.current {
    background: rgba(99, 102, 241, 0.15);
    border-color: var(--color-ring-primary);
    font-weight: 600;
  }

  .chain-arrow {
    color: var(--color-text-secondary);
    font-size: 0.75rem;
  }
</style>
