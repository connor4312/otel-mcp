<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    onclick?: () => void;
    disabled?: boolean;
    variant?: 'default' | 'primary' | 'sm';
    children: Snippet;
  }

  let { onclick, disabled = false, variant = 'default', children }: Props = $props();
</script>

<button class="btn {variant}" {onclick} {disabled}>
  {@render children()}
</button>

<style>
  .btn {
    padding: 6px 14px;
    border: 1px solid var(--color-border-primary);
    border-radius: var(--border-radius-md, 8px);
    background: var(--color-background-secondary);
    color: var(--color-text-primary);
    font-size: 0.8rem;
    cursor: pointer;
    font-family: inherit;
    transition: background 0.15s;
  }

  .btn:hover { background: var(--color-background-tertiary); }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn.primary {
    background: #6366f1;
    color: white;
    border-color: #6366f1;
  }
  .btn.primary:hover { background: #818cf8; }
  .btn.primary:disabled { background: #6366f1; }

  .btn.sm {
    padding: 4px 10px;
    font-size: 0.75rem;
  }
</style>
