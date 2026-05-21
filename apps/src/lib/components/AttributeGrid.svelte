<script lang="ts">
  interface Props {
    attributes: Record<string, string>;
  }

  let { attributes }: Props = $props();

  let entries = $derived(Object.entries(attributes));
</script>

{#if entries.length > 0}
  <div class="attr-grid">
    {#each entries as [key, val]}
      <div class="attr-key">{key}</div>
      <div class="attr-val">{val}</div>
    {/each}
  </div>
{/if}

<style>
  .attr-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 2px 12px;
    font-size: 0.8rem;
  }

  .attr-key {
    color: var(--color-text-secondary);
    font-weight: 500;
    white-space: nowrap;
  }

  .attr-val {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    word-break: break-all;
  }
</style>
