<script lang="ts">
  import { onMount } from 'svelte';
  import { initializeApp, on, send, notify, reportSize, destroyMessageListener } from '$lib/mcp';
  import { applyTheme } from '$lib/theme';
  import { fmt } from '$lib/utils';
  import type { TraceDetail, TraceDetailSpan } from '$lib/types';
  import Button from '$lib/components/Button.svelte';

  let detail = $state<TraceDetail | null>(null);
  let isFullscreen = $state(false);
  let hostAvailableDisplayModes = $state<string[]>([]);
  let expandedSpanIdx = $state<number | null>(null);

  const svcColors = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316',
    '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#3b82f6'
  ];
  const svcColorMap = new Map<string, string>();
  function colorFor(svc: string): string {
    if (!svcColorMap.has(svc)) svcColorMap.set(svc, svcColors[svcColorMap.size % svcColors.length]);
    return svcColorMap.get(svc)!;
  }

  function getDepth(spans: TraceDetailSpan[]): Map<string, number> {
    const depthMap = new Map<string, number>();
    for (const s of spans) {
      const parentDepth = depthMap.get(s.parentSpanId) ?? -1;
      depthMap.set(s.spanId, parentDepth + 1);
    }
    return depthMap;
  }

  let depthMap = $derived(detail ? getDepth(detail.spans) : new Map());
  let totalMs = $derived(detail ? detail.durationMs || 1 : 1);
  const kindNames = ['UNSPECIFIED', 'INTERNAL', 'SERVER', 'CLIENT', 'PRODUCER', 'CONSUMER'];

  let rulerMarks = $derived(
    Array.from({ length: 6 }, (_, i) => fmt((totalMs / 5) * i))
  );

  function toggleSpan(idx: number) {
    expandedSpanIdx = expandedSpanIdx === idx ? null : idx;
  }

  async function inspectSpan(span: TraceDetailSpan) {
    if (!detail) return;
    try {
      await send('ui/message', {
        role: 'user',
        content: {
          type: 'text',
          text: `Inspect span "${span.name}" (spanId: ${span.spanId}) in trace ${detail.traceId}`
        }
      });
    } catch {}
  }

  async function updateContext() {
    if (!detail) return;
    const d = detail;
    const ctx = [
      `---`,
      `trace-id: ${d.traceId}`,
      `root-span: ${d.rootSpanName}`,
      `duration: ${d.durationMs}ms`,
      `span-count: ${d.spanCount}`,
      `error-count: ${d.errorCount}`,
      `services: ${d.services.join(', ')}`,
      `---`,
      ``,
      `Span hierarchy:`,
      ...d.spans.map(
        (s) =>
          `- ${'  '.repeat(Math.min(5, s.startOffsetMs > 0 ? 1 : 0))}${s.name} (${s.serviceName}, ${s.durationMs}ms${s.statusCode === 2 ? ', ERROR' : ''})`
      )
    ].join('\n');

    try {
      await send('ui/update-model-context', { content: [{ type: 'text', text: ctx }] });
    } catch {}
  }

  async function handleFullscreen() {
    const newMode = isFullscreen ? 'inline' : 'fullscreen';
    if (!hostAvailableDisplayModes.includes(newMode)) return;
    try {
      const r = await send('ui/request-display-mode', { mode: newMode });
      isFullscreen = r?.mode === 'fullscreen';
    } catch {}
  }

  async function handleAnalyze() {
    if (!detail) return;
    await updateContext();
    try {
      await send('ui/message', {
        role: 'user',
        content: {
          type: 'text',
          text:
            `Analyze the performance of trace "${detail.rootSpanName}" (${detail.traceId.slice(0, 8)}…). ` +
            `It has ${detail.spanCount} spans over ${detail.durationMs}ms. ` +
            `Look for bottlenecks, unusually slow spans, and suggest optimizations.`
        }
      });
    } catch {}
  }

  onMount(() => {
    on('ui/notifications/tool-result', (params: any) => {
      if (params?.structuredContent) {
        detail = params.structuredContent;
        expandedSpanIdx = null;
        svcColorMap.clear();
        updateContext();
      }
    });

    on('ui/notifications/tool-input-partial', (params: any) => {
      if (params?.arguments?.traceId) {
        detail = null;
      }
    });

    on('ui/notifications/tool-input', () => {});

    on('ui/notifications/host-context-changed', (ctx: any) => {
      applyTheme(ctx);
      if (ctx.displayMode) isFullscreen = ctx.displayMode === 'fullscreen';
      if (ctx.availableDisplayModes) hostAvailableDisplayModes = ctx.availableDisplayModes;
    });

    const cleanupResize = reportSize();

    initializeApp({
      name: 'otel-trace-detail',
      version: '0.1.0',
      capabilities: { availableDisplayModes: ['inline', 'fullscreen'] }
    }).then((result) => {
      if (result?.hostContext) {
        applyTheme(result.hostContext);
        if (result.hostContext.availableDisplayModes)
          hostAvailableDisplayModes = result.hostContext.availableDisplayModes;
        isFullscreen = result.hostContext.displayMode === 'fullscreen';
      }
    });

    return () => {
      cleanupResize();
      destroyMessageListener();
    };
  });
</script>

{#if !detail}
  <div class="header">
    <h1>Trace Detail</h1>
  </div>
{:else}
  <div class="header">
    <div>
      <h1>{detail.rootSpanName}</h1>
      <span class="header-meta">{detail.traceId.slice(0, 16)}… · {new Date(detail.startTime).toLocaleString()}</span>
    </div>
  </div>

  <div class="stats-row">
    <span class="stat"><b>{detail.spanCount}</b> spans</span>
    <span class="stat"><b>{fmt(detail.durationMs)}</b> total</span>
    <span class="stat"><b>{detail.errorCount}</b> errors</span>
    <span class="stat">Services: <b>{detail.services.join(', ')}</b></span>
  </div>

  <div class="actions">
    <Button onclick={handleFullscreen}>
      {#snippet children()}{isFullscreen ? '⛶ Exit Fullscreen' : '⛶ Fullscreen'}{/snippet}
    </Button>
    <Button variant="primary" onclick={handleAnalyze}>
      {#snippet children()}🔍 Analyze This Trace{/snippet}
    </Button>
  </div>

  <div class="waterfall">
    <div class="ruler">
      {#each rulerMarks as mark}
        <span>{mark}</span>
      {/each}
    </div>

    {#each detail.spans as span, i}
      {@const depth = depthMap.get(span.spanId) ?? 0}
      {@const leftPct = (span.startOffsetMs / totalMs) * 100}
      {@const widthPct = Math.max(0.3, (span.durationMs / totalMs) * 100)}
      {@const color = colorFor(span.serviceName)}
      {@const isErr = span.statusCode === 2}

      <button
        class="span-row"
        class:error={isErr}
        onclick={() => toggleSpan(i)}
      >
        <div class="span-label" title={span.name}>
          <span class="indent" style="width:{depth * 16}px"></span>
          <span class="dot" style="background:{color}"></span>
          {span.name}
          <span style="color:var(--color-text-secondary);font-size:0.7rem;margin-left:4px">{fmt(span.durationMs)}</span>
        </div>
        <div class="span-bar-area">
          <div
            class="span-bar"
            style="left:{leftPct}%;width:{widthPct}%;background:{color}"
            title="{span.name}: {fmt(span.durationMs)}"
          ></div>
        </div>
      </button>

      {#if expandedSpanIdx === i}
        <div class="span-detail">
          <h3>{span.name}</h3>
          <table class="attr-table">
            <tbody>
            <tr><td>Span ID</td><td>{span.spanId}</td></tr>
            <tr><td>Service</td><td>{span.serviceName}</td></tr>
            <tr><td>Duration</td><td>{fmt(span.durationMs)}</td></tr>
            <tr><td>Start Offset</td><td>{fmt(span.startOffsetMs)}</td></tr>
            <tr><td>Status</td><td>{isErr ? 'ERROR' : 'OK'}</td></tr>
            <tr><td>Kind</td><td>{kindNames[span.kind] ?? span.kind}</td></tr>
            {#each Object.entries(span.attributes || {}) as [key, val]}
              <tr><td>{key}</td><td>{val}</td></tr>
            {/each}
            </tbody>
          </table>
          <Button variant="sm" onclick={() => inspectSpan(span)}>
            {#snippet children()}🔍 Inspect this span{/snippet}
          </Button>
        </div>
      {/if}
    {/each}
  </div>
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
    --color-border-primary: light-dark(#e5e7eb, #2e3348);
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

  .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
  .header h1 { font-size: 1.1rem; font-weight: 600; }
  .header-meta { font-size: 0.8rem; color: var(--color-text-secondary); font-family: var(--font-mono); }

  .stats-row { display: flex; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
  .stat { font-size: 0.82rem; }

  .actions { display: flex; gap: 8px; margin-bottom: 16px; }

  .waterfall { position: relative; overflow-x: auto; }

  .span-row {
    display: grid;
    grid-template-columns: minmax(200px, 35%) 1fr;
    border: none;
    border-bottom: 1px solid var(--color-border-primary);
    min-height: 28px;
    align-items: center;
    font-size: 0.8rem;
    width: 100%;
    background: none;
    padding: 0;
    cursor: pointer;
    text-align: left;
    color: inherit;
    font-family: inherit;
  }
  .span-row:hover { background: var(--color-background-tertiary); }
  .span-row.error { background: rgba(239,68,68,0.06); }

  .span-label { padding: 4px 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-family: var(--font-mono); font-size: 0.78rem; cursor: pointer; }
  .span-label .indent { display: inline-block; }
  .span-label .dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; }

  .span-bar-area { position: relative; height: 28px; }
  .span-bar { position: absolute; top: 8px; height: 12px; border-radius: 3px; min-width: 2px; transition: opacity 0.1s; }
  .span-bar:hover { opacity: 0.8; }
  .span-row.error .span-bar { background: #ef4444 !important; }

  .span-detail { background: var(--color-background-secondary); border: 1px solid var(--color-border-primary); border-radius: var(--border-radius-md); padding: 12px 16px; margin: 8px 0; font-size: 0.82rem; }
  .span-detail h3 { font-size: 0.9rem; margin-bottom: 8px; }

  .attr-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
  .attr-table td { padding: 3px 8px; border-bottom: 1px solid var(--color-border-primary); }
  .attr-table td:first-child { font-weight: 500; color: var(--color-text-secondary); white-space: nowrap; width: 200px; }
  .attr-table td:last-child { font-family: var(--font-mono); word-break: break-all; }

  .ruler { display: flex; justify-content: space-between; padding: 0 0 4px 35%; font-size: 0.68rem; color: var(--color-text-secondary); font-family: var(--font-mono); }
</style>
