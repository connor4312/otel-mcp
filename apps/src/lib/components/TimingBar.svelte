<script lang="ts">
  import { fmt } from '$lib/utils';

  interface Props {
    selfPct: number;
    selfMs: number;
    childrenMs: number;
  }

  let { selfPct, selfMs, childrenMs }: Props = $props();

  let childPct = $derived(100 - selfPct);
</script>

<div class="timing-bar">
  <div class="timing-self" style="width:{selfPct}%" title="Self: {fmt(selfMs)}"></div>
  <div class="timing-children" style="width:{childPct}%" title="Children: {fmt(childrenMs)}"></div>
</div>
<div class="timing-legend">
  <span class="self">Self time</span>
  <span class="child">Children</span>
</div>

<style>
  .timing-bar {
    display: flex;
    height: 24px;
    border-radius: 6px;
    overflow: hidden;
    background: var(--color-background-tertiary);
  }

  .timing-self { background: #6366f1; }
  .timing-children { background: #6366f133; }

  .timing-legend {
    display: flex;
    gap: 16px;
    margin-top: 6px;
    font-size: 0.75rem;
    color: var(--color-text-secondary);
  }

  .timing-legend span::before {
    content: '';
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 2px;
    margin-right: 4px;
    vertical-align: middle;
  }

  .timing-legend .self::before { background: #6366f1; }
  .timing-legend .child::before { background: #6366f133; }
</style>
