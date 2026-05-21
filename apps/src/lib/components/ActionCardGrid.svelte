<script lang="ts">
  interface Action {
    id: string;
    icon: string;
    title: string;
    desc: string;
  }

  interface Props {
    actions: Action[];
    onaction: (id: string) => void;
  }

  let { actions, onaction }: Props = $props();
</script>

<div class="action-cards">
  {#each actions as a}
    <button class="action-card" onclick={() => onaction(a.id)}>
      <div class="icon">{a.icon}</div>
      <div class="title">{a.title}</div>
      <div class="desc">{a.desc}</div>
    </button>
  {/each}
</div>

<style>
  .action-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 10px;
  }

  .action-card {
    background: var(--color-background-secondary);
    border: 2px solid var(--color-border-primary);
    border-radius: var(--border-radius-lg, 12px);
    padding: 14px 16px;
    cursor: pointer;
    transition: all 0.15s;
    user-select: none;
    text-align: left;
    color: var(--color-text-primary);
    font-family: inherit;
  }

  .action-card:hover {
    background: var(--color-background-tertiary);
    border-color: var(--color-ring-primary);
  }

  .action-card .icon { font-size: 1.3rem; margin-bottom: 4px; }
  .action-card .title { font-weight: 600; font-size: 0.88rem; margin-bottom: 2px; }
  .action-card .desc { font-size: 0.75rem; color: var(--color-text-secondary); }
</style>
