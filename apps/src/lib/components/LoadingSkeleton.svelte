<script lang="ts">
  interface Props {
    count?: number;
    variant?: 'card' | 'line';
  }

  let { count = 4, variant = 'card' }: Props = $props();
</script>

{#if variant === 'card'}
  <div class="loading-grid">
    {#each Array(count) as _}
      <div class="skeleton card"></div>
    {/each}
  </div>
{:else}
  <div class="loading-table">
    {#each Array(count) as _, i}
      <div class="skeleton line" style="width:{80 - i * 10}%"></div>
    {/each}
  </div>
{/if}

<style>
  .skeleton {
    background: var(--color-background-tertiary);
    border-radius: 4px;
    animation: shimmer 1.5s infinite;
  }

  @keyframes shimmer { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }

  .loading-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 20px;
  }

  .skeleton.card {
    height: 60px;
    border-radius: var(--border-radius-md, 8px);
  }

  .loading-table {
    margin-bottom: 20px;
  }

  .skeleton.line {
    height: 14px;
    margin-bottom: 10px;
  }
</style>
