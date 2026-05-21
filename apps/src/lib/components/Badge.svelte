<script lang="ts">
  interface Props {
    type: 'err' | 'ok';
    text?: string;
  }

  let { type, text }: Props = $props();

  let defaultText = $derived(type === 'err' ? 'ERR' : 'OK');
</script>

<span class="badge {type}">{text ?? defaultText}</span>

<style>
  .badge {
    display: inline-block;
    padding: 1px 7px;
    border-radius: 999px;
    font-size: 0.68rem;
    font-weight: 600;
  }

  .badge.err {
    background: rgba(239, 68, 68, 0.15);
    color: var(--color-text-danger);
  }

  .badge.ok {
    background: rgba(34, 197, 94, 0.15);
    color: var(--color-text-success);
  }
</style>
