<script lang="ts">
  interface Props {
    type: 'error' | 'success' | 'loading';
    message: string;
  }

  let { type, message }: Props = $props();
</script>

<div class="status {type}">
  {#if type === 'loading'}<span class="spinner"></span>{/if}
  {message}
</div>

<style>
  .status {
    margin-top: 16px;
    padding: 12px 16px;
    border-radius: 8px;
    font-size: 0.85rem;
  }

  .status.error {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: var(--color-text-danger);
  }

  .status.success {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: var(--color-text-success);
  }

  .status.loading {
    background: rgba(99, 102, 241, 0.1);
    border: 1px solid rgba(99, 102, 241, 0.3);
    color: #6366f1;
  }

  .spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
    vertical-align: middle;
    margin-right: 6px;
  }

  @keyframes spin { to { transform: rotate(360deg); } }
</style>
