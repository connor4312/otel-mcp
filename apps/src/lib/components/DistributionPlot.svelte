<script lang="ts">
  import { fmt } from '$lib/utils';

  interface Props {
    durations: number[];
    currentMs: number;
    minMs: number;
    maxMs: number;
    avgMs: number;
    p50Ms: number;
    p95Ms: number;
    thisRank: number;
    count: number;
  }

  let { durations, currentMs, minMs, maxMs, avgMs, p50Ms, p95Ms, thisRank, count }: Props = $props();

  let range = $derived(maxMs - minMs);
</script>

<div class="distro">
  {#each durations as d}
    {@const pct = range > 0 ? ((d - minMs) / range) * 100 : 50}
    {@const isCurrent = Math.abs(d - currentMs) < 0.01}
    <div class="distro-dot" class:this={isCurrent} style="left:{pct}%"></div>
  {/each}
</div>
<div class="distro-labels">
  <span>{fmt(minMs)}</span>
  <span>p50: {fmt(p50Ms)}</span>
  <span>p95: {fmt(p95Ms)}</span>
  <span>{fmt(maxMs)}</span>
</div>
<div class="distro-stat">
  This span: <b>{fmt(currentMs)}</b> · avg: <b>{fmt(avgMs)}</b> · rank <b>{thisRank}</b> of <b>{count}</b>
</div>

<style>
  .distro {
    position: relative;
    height: 40px;
    background: var(--color-background-secondary);
    border: 1px solid var(--color-border-primary);
    border-radius: 6px;
    margin-bottom: 6px;
    overflow: hidden;
  }

  .distro-dot {
    position: absolute;
    top: 50%;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #6366f144;
    transform: translateY(-50%);
  }

  .distro-dot.this {
    width: 8px;
    height: 8px;
    background: #ef4444;
    z-index: 2;
    border: 2px solid #fff;
  }

  .distro-labels {
    display: flex;
    justify-content: space-between;
    font-size: 0.68rem;
    color: var(--color-text-secondary);
    font-family: var(--font-mono);
  }

  .distro-stat {
    font-size: 0.78rem;
    color: var(--color-text-secondary);
    margin-top: 4px;
  }
</style>
