<script lang="ts">
  import type { ExampleSpan } from '$lib/types';
  import { fmt } from '$lib/utils';

  interface Props {
    severity: string;
    title: string;
    detail: string;
    exampleSpan?: ExampleSpan;
    onSpanClick?: (span: ExampleSpan) => void;
  }

  let { severity, title, detail, exampleSpan, onSpanClick }: Props = $props();
</script>

<div class="finding {severity}">
  <span class="finding-severity {severity}">{severity}</span>
  <span class="finding-title">{title}</span>
  <div class="finding-detail">{detail}</div>
  {#if exampleSpan}
    <button
      class="example-span"
      onclick={() => onSpanClick?.(exampleSpan!)}
      title="Inspect this span"
    >
      <span class="example-label">Example span</span>
      <span class="example-name">{exampleSpan.name}</span>
      <span class="example-meta">
        <span class="example-service">{exampleSpan.serviceName}</span>
        <span class="example-duration">{fmt(exampleSpan.durationMs)}</span>
      </span>
      <span class="example-arrow">→</span>
    </button>
  {/if}
</div>

<style>
  .finding {
    padding: 10px 14px;
    border-left: 3px solid var(--color-border-primary);
    background: var(--color-background-secondary);
    border-radius: 0 var(--border-radius-md, 8px) var(--border-radius-md, 8px) 0;
    margin-bottom: 8px;
  }

  .finding.critical { border-left-color: var(--color-text-danger); }
  .finding.warning { border-left-color: #f59e0b; }
  .finding.info { border-left-color: #6366f1; }

  .finding-title {
    font-weight: 600;
    font-size: 0.85rem;
  }

  .finding-detail {
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    margin-top: 2px;
    font-family: var(--font-mono);
  }

  .finding-severity {
    font-size: 0.68rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-right: 6px;
  }
  .finding-severity.critical { color: var(--color-text-danger); }
  .finding-severity.warning { color: #f59e0b; }
  .finding-severity.info { color: #6366f1; }

  .example-span {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
    padding: 6px 10px;
    background: var(--color-background-tertiary, rgba(99,102,241,0.06));
    border: 1px solid var(--color-border-primary);
    border-radius: 6px;
    cursor: pointer;
    width: 100%;
    text-align: left;
    font-family: inherit;
    font-size: 0.78rem;
    color: var(--color-text-primary);
    transition: background 0.15s, border-color 0.15s;
  }
  .example-span:hover {
    background: rgba(99,102,241,0.1);
    border-color: #6366f1;
  }
  .example-span:active {
    background: rgba(99,102,241,0.18);
  }

  .example-label {
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-secondary);
    white-space: nowrap;
  }

  .example-name {
    font-family: var(--font-mono);
    font-weight: 500;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .example-meta {
    display: flex;
    gap: 8px;
    align-items: center;
    white-space: nowrap;
  }

  .example-service {
    font-size: 0.72rem;
    color: var(--color-text-secondary);
    padding: 1px 6px;
    background: var(--color-background-secondary);
    border-radius: 4px;
  }

  .example-duration {
    font-family: var(--font-mono);
    font-weight: 600;
    font-size: 0.75rem;
    color: #6366f1;
  }

  .example-arrow {
    font-size: 0.85rem;
    color: var(--color-text-secondary);
    transition: transform 0.15s;
  }
  .example-span:hover .example-arrow {
    transform: translateX(2px);
    color: #6366f1;
  }
</style>
