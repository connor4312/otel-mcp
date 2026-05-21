<script lang="ts">
  import { onMount } from 'svelte';
  import { initializeApp, on, send, reportSize, destroyMessageListener } from '$lib/mcp';
  import { applyTheme } from '$lib/theme';
  import { fmt } from '$lib/utils';
  import Badge from '$lib/components/Badge.svelte';

  interface TopSpan {
    traceId: string;
    spanId: string;
    name: string;
    serviceName: string;
    durationMs: number;
    statusCode: number;
  }

  let spans = $state<TopSpan[]>([]);
  let requestId = $state<string | null>(null);
  let submitted = $state(false);

  let maxDuration = $derived(spans.length > 0 ? spans[0].durationMs : 1);

  async function pickSpan(span: TopSpan) {
    if (!requestId || submitted) return;
    submitted = true;

    try {
      await send('tools/call', {
        name: 'user-picked-span',
        arguments: {
          requestId,
          traceId: span.traceId,
          spanId: span.spanId,
        },
      });
    } catch (err) {
      console.error('Failed to submit span pick:', err);
      submitted = false;
    }
  }

  onMount(() => {
    on('ui/notifications/tool-input', (params: any) => {
      requestId = params?.arguments?.requestId ?? null;
    });

    on('ui/notifications/tool-result', (params: any) => {
      if (params?.structuredContent?.topSpans) {
        spans = params.structuredContent.topSpans;
        submitted = false;
      }
    });

    on('ui/notifications/tool-input-partial', () => {});
    on('ui/notifications/host-context-changed', applyTheme);

    const cleanupResize = reportSize();

    initializeApp({ name: 'otel-pick-span-detail', version: '0.1.0' }).then((result) => {
      if (result?.hostContext) applyTheme(result.hostContext);
    });

    return () => {
      cleanupResize();
      destroyMessageListener();
    };
  });
</script>

<h1>Pick a Span to Analyze</h1>
<div class="subtitle">Top 10 longest spans — click one to inspect it in detail</div>

{#if spans.length > 0 && !submitted}
  <div class="span-list">
    {#each spans as span, i}
      <button class="span-row" onclick={() => pickSpan(span)}>
        <div class="rank">#{i + 1}</div>
        <div class="span-info">
          <div class="span-name">{span.name}</div>
          <div class="span-meta">{span.serviceName} · {span.traceId.slice(0, 8)}… · {span.spanId.slice(0, 8)}…</div>
        </div>
        <div class="span-right">
          <div class="span-duration">{fmt(span.durationMs)}</div>
          {#if span.statusCode === 2}
            <Badge type="err" />
          {:else}
            <Badge type="ok" />
          {/if}
        </div>
        <div class="bar-track">
          <div class="bar-fill" style="width: {(span.durationMs / maxDuration) * 100}%"></div>
        </div>
      </button>
    {/each}
  </div>
{:else if submitted}
  <div class="submitted">✓ Span selected — the model is now analyzing it.</div>
{/if}

<style>
  :root {
    --color-background-primary: light-dark(#ffffff, #0f1117);
    --color-background-secondary: light-dark(#f8f9fa, #1a1d27);
    --color-background-tertiary: light-dark(#e9ecef, #22263a);
    --color-text-primary: light-dark(#171717, #e2e8f0);
    --color-text-secondary: light-dark(#6b7280, #94a3b8);
    --color-text-danger: light-dark(#dc2626, #ef4444);
    --color-text-success: light-dark(#16a34a, #22c55e);
    --color-text-warning: light-dark(#d97706, #f59e0b);
    --color-border-primary: light-dark(#e5e7eb, #2e3348);
    --color-ring-primary: light-dark(#6366f1, #818cf8);
    --color-accent: light-dark(#6366f1, #818cf8);
    --color-accent-bg: light-dark(rgba(99, 102, 241, 0.08), rgba(129, 140, 248, 0.1));
    --font-sans: system-ui, -apple-system, sans-serif;
    --font-mono: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
    --border-radius-md: 8px;
    --border-radius-lg: 12px;
    color-scheme: light dark;
  }

  :global(*) { margin: 0; padding: 0; box-sizing: border-box; }
  :global(body) {
    font-family: var(--font-sans);
    background: var(--color-background-primary);
    color: var(--color-text-primary);
    padding: 16px;
    line-height: 1.5;
  }

  h1 { font-size: 1.15rem; font-weight: 600; margin-bottom: 2px; }
  .subtitle { font-size: 0.8rem; color: var(--color-text-secondary); margin-bottom: 16px; }

  .span-list { display: flex; flex-direction: column; gap: 6px; }

  .span-row {
    display: grid;
    grid-template-columns: 32px 1fr auto;
    grid-template-rows: auto auto;
    gap: 0 10px;
    align-items: center;
    padding: 10px 12px;
    border: 1px solid var(--color-border-primary);
    border-radius: var(--border-radius-md);
    background: var(--color-background-secondary);
    cursor: pointer;
    text-align: left;
    font: inherit;
    color: inherit;
    transition: border-color 0.15s, background 0.15s;
    width: 100%;
  }

  .span-row:hover {
    border-color: var(--color-accent);
    background: var(--color-accent-bg);
  }

  .rank {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--color-text-secondary);
    grid-row: 1 / 3;
  }

  .span-info { min-width: 0; }
  .span-name {
    font-family: var(--font-mono);
    font-size: 0.82rem;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .span-meta {
    font-size: 0.72rem;
    color: var(--color-text-secondary);
    font-family: var(--font-mono);
  }

  .span-right {
    display: flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
  }
  .span-duration {
    font-family: var(--font-mono);
    font-size: 0.82rem;
    font-weight: 600;
  }

  .bar-track {
    grid-column: 2 / 4;
    height: 4px;
    background: var(--color-background-tertiary);
    border-radius: 2px;
    margin-top: 6px;
    overflow: hidden;
  }
  .bar-fill {
    height: 100%;
    background: var(--color-accent);
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .submitted {
    text-align: center;
    padding: 20px;
    color: var(--color-text-secondary);
    font-size: 0.9rem;
  }
</style>
