<script lang="ts">
  import Button from './Button.svelte';

  interface Props {
    label?: string;
    disabled?: boolean;
    variant?: 'default' | 'primary' | 'sm';
    onclick?: () => void;
  }

  let { label = 'Button', disabled = false, variant = 'default', onclick = () => {} }: Props = $props();
</script>

<Button {variant} {disabled} {onclick}>
  {label}
</Button>
