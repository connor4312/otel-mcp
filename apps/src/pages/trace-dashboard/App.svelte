<script lang="ts">
  import { onMount } from 'svelte';
  import { initializeApp, on, send, reportSize, destroyMessageListener } from '$lib/mcp';
  import { applyTheme } from '$lib/theme';
  import { fmt } from '$lib/utils';
  import type { DashboardData, AnalysisResult, TraceSummary, ExampleSpan } from '$lib/types';
  import StatCard from '$lib/components/StatCard.svelte';
  import Button from '$lib/components/Button.svelte';
  import FindingCard from '$lib/components/FindingCard.svelte';
  import Badge from '$lib/components/Badge.svelte';
  import LoadingSkeleton from '$lib/components/LoadingSkeleton.svelte';

  let data = $state<DashboardData | null>(null);
  let loading = $state(true);
  let analyzing = $state(false);
  let exporting = $state(false);
  let analysis = $state<AnalysisResult | null>(null);

  let maxAvg = $derived(
    data ? Math.max(...data.spanNames.map((s) => s.avgDurationMs), 1) : 1
  );

  let traceRows = $derived((data?.traces || []).slice(0, 20));

  async function handleAnalyze() {
    if (!data) return;
    const ctx = [
      `---`,
      `total-traces: ${data.totalTraces}`,
      `total-spans: ${data.totalSpans}`,
      `error-rate: ${data.errorRate}%`,
      `p50: ${data.latencyPercentiles.p50}ms`,
      `p95: ${data.latencyPercentiles.p95}ms`,
      `p99: ${data.latencyPercentiles.p99}ms`,
      `services: ${data.services.map((s) => s.name).join(', ')}`,
      `---`,
      ``,
      `Top operations:`,
      ...data.spanNames
        .slice(0, 10)
        .map((s) => `- ${s.name}: ${s.count}× avg ${s.avgDurationMs}ms p99 ${s.p99DurationMs}ms`)
    ].join('\n');

    await send('ui/update-model-context', { content: [{ type: 'text', text: ctx }] });
    await send('ui/message', {
      role: 'user',
      content: {
        type: 'text',
        text: 'Analyze these OpenTelemetry traces. What patterns do you see? Are there any performance concerns or anomalies?'
      }
    });
  }

  async function handleDeepAnalysis() {
    analyzing = true;
    try {
      const r = await send('tools/call', { name: 'deep-analysis', arguments: {} });
      if (r?.structuredContent) {
        renderAnalysis(r.structuredContent);
      } else if (r?.content?.[0]?.text) {
        analysis = { summary: r.content[0].text, findings: [] };
      }
    } catch (err) {
      console.error('Deep analysis failed:', err);
    } finally {
      analyzing = false;
    }
  }

  function renderAnalysis(result: AnalysisResult) {
    analysis = result;
    const ctx = [
      `---`,
      `analysis-focus: ${result.config?.focus}`,
      `findings-count: ${result.findings?.length}`,
      `---`,
      ``,
      ...result.findings.map((f) => `[${f.severity.toUpperCase()}] ${f.title}: ${f.detail}`)
    ].join('\n');
    send('ui/update-model-context', { content: [{ type: 'text', text: ctx }] }).catch(() => {});
  }

  async function handleExport() {
    exporting = true;
    try {
      const r = await send('tools/call', { name: 'export-traces', arguments: {} });
      const url = r?.structuredContent?.downloadUrl;
      if (url) {
        await send('ui/open-link', { url });
      }
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      exporting = false;
    }
  }

  async function handleTraceClick(trace: TraceSummary) {
    try {
      await send('ui/message', {
        role: 'user',
        content: [
          { type: 'text', text: `Show me the detail for trace ${trace.traceId} ("${trace.rootSpanName}")` }
        ]
      });
    } catch (err) {
      console.error('ui/message failed:', err);
    }
  }

  async function handleExampleSpanClick(span: ExampleSpan) {
    try {
      await send('ui/message', {
        role: 'user',
        content: [
          { type: 'text', text: `Inspect span "${span.name}" (spanId: ${span.spanId}, traceId: ${span.traceId}) from service "${span.serviceName}" — it took ${span.durationMs}ms. What's causing the latency?` }
        ]
      });
    } catch (err) {
      console.error('ui/message failed:', err);
    }
  }

  onMount(() => {
    on('ui/notifications/tool-result', (params: any) => {
      if (params?.structuredContent) {
        data = params.structuredContent;
        loading = false;
      }
    });

    on('ui/notifications/tool-input-partial', (params: any) => {
      loading = true;
      if (params?.arguments?.totalTraces != null) {
        try {
          data = params.arguments;
          loading = false;
        } catch {}
      }
    });

    on('ui/notifications/tool-input', () => {});
    on('ui/notifications/tool-cancelled', () => {});
    on('ui/notifications/host-context-changed', applyTheme);
    on('ui/resource-teardown', () => {});

    const cleanupResize = reportSize();

    initializeApp({ name: 'otel-trace-dashboard', version: '0.1.0' }).then((result) => {
      if (result?.hostContext) applyTheme(result.hostContext);
    });

    return () => {
      cleanupResize();
      destroyMessageListener();
    };
  });
</script>

{#if loading}
  <LoadingSkeleton variant="card" count={4} />
  <LoadingSkeleton variant="line" count={4} />
{:else if data}
  <div class="stats-grid">
    <StatCard label="Traces" value={data.totalTraces} />
    <StatCard label="Spans" value={data.totalSpans} />
    <StatCard label="Error Rate" value="{data.errorRate}%" variant={data.errorRate > 5 ? 'error' : 'ok'} />
    <StatCard label="p50 Latency" value={fmt(data.latencyPercentiles.p50)} />
    <StatCard label="p95 Latency" value={fmt(data.latencyPercentiles.p95)} />
    <StatCard label="p99 Latency" value={fmt(data.latencyPercentiles.p99)} />
  </div>

  <div class="actions">
    <Button onclick={handleAnalyze}>{#snippet children()}🔍 Analyze Traces{/snippet}</Button>
    <Button variant="primary" onclick={handleDeepAnalysis} disabled={analyzing}>
      {#snippet children()}{analyzing ? '⏳ Analyzing with LLM…' : '🧪 Deep Analysis'}{/snippet}
    </Button>
    <Button onclick={handleExport} disabled={exporting}>
      {#snippet children()}{exporting ? '⏳ Exporting…' : '📥 Export JSON'}{/snippet}
    </Button>
  </div>

  {#if analysis}
    <div class="section">
      <h2>Analysis Results</h2>
      <div class="analysis-summary">
        {analysis.summary}{analysis.model ? ` (via ${analysis.model})` : ''}
      </div>
      <div class="findings">
        {#each analysis.findings as f}
          <FindingCard severity={f.severity} title={f.title} detail={f.detail} exampleSpan={f.exampleSpan} onSpanClick={handleExampleSpanClick} />
        {/each}
      </div>
    </div>
  {/if}

  <div class="section">
    <h2>Top Operations</h2>
    <table>
      <thead>
        <tr><th>Name</th><th>Count</th><th>Avg</th><th>p99</th><th>Distribution</th></tr>
      </thead>
      <tbody>
        {#each data.spanNames.slice(0, 15) as op}
          <tr>
            <td class="mono">{op.name}</td>
            <td>{op.count}</td>
            <td class="mono">{fmt(op.avgDurationMs)}</td>
            <td class="mono">{fmt(op.p99DurationMs)}</td>
            <td class="bar-cell">
              <div class="bar" style="width:{Math.max(2, (op.avgDurationMs / maxAvg) * 100)}%"></div>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <div class="section">
    <h2>Slowest Traces</h2>
    <table>
      <thead>
        <tr><th>Trace</th><th>Root Span</th><th>Spans</th><th>Duration</th><th>Errors</th><th>Time</th></tr>
      </thead>
      <tbody>
        {#each traceRows as trace}
          <tr class="clickable" onclick={() => handleTraceClick(trace)}>
            <td class="mono">{trace.traceId.slice(0, 8)}…</td>
            <td>{trace.rootSpanName}</td>
            <td>{trace.spanCount}</td>
            <td class="mono">{fmt(trace.durationMs)}</td>
            <td>
              {#if trace.errorCount > 0}
                <Badge type="err" text="{trace.errorCount} err" />
              {:else}
                <Badge type="ok" />
              {/if}
            </td>
            <td class="mono" style="font-size:0.75rem">{new Date(trace.startTime).toLocaleTimeString()}</td>
          </tr>
        {/each}
      </tbody>
    </table>
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

  .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 20px; }

  h2 { font-size: 1rem; font-weight: 600; margin-bottom: 10px; color: var(--color-text-secondary); }
  .section { margin-bottom: 24px; }

  table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
  th { text-align: left; padding: 8px 10px; border-bottom: 2px solid var(--color-border-primary); color: var(--color-text-secondary); font-weight: 600; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; }
  td { padding: 7px 10px; border-bottom: 1px solid var(--color-border-primary); }
  tr:hover td { background: var(--color-background-tertiary); }
  tr.clickable { cursor: pointer; }
  tr.clickable:active td { background: rgba(99,102,241,0.1); }

  .mono { font-family: var(--font-mono); font-size: 0.8rem; }
  .bar-cell { position: relative; }
  .bar { height: 6px; border-radius: 3px; background: #6366f1; min-width: 2px; }

  .actions { display: flex; gap: 8px; margin-bottom: 16px; }

  .findings { margin-top: 16px; }
  .analysis-summary { font-size: 0.85rem; color: var(--color-text-secondary); margin-bottom: 12px; }
</style>
