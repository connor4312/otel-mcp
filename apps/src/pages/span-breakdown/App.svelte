<script lang="ts">
  import { onMount } from 'svelte';
  import { initializeApp, on, send, reportSize, destroyMessageListener } from '$lib/mcp';
  import { applyTheme } from '$lib/theme';
  import { fmt } from '$lib/utils';
  import type { SpanBreakdownData } from '$lib/types';
  import StatCard from '$lib/components/StatCard.svelte';
  import TimingBar from '$lib/components/TimingBar.svelte';
  import CallChain from '$lib/components/CallChain.svelte';
  import DistributionPlot from '$lib/components/DistributionPlot.svelte';
  import AttributeGrid from '$lib/components/AttributeGrid.svelte';
  import ActionCardGrid from '$lib/components/ActionCardGrid.svelte';
  import Badge from '$lib/components/Badge.svelte';

  let data = $state<SpanBreakdownData | null>(null);
  let requestId = $state<string | null>(null);
  let submitted = $state(false);

  const kindNames = ['UNSPECIFIED', 'INTERNAL', 'SERVER', 'CLIENT', 'PRODUCER', 'CONSUMER'];

  let selfPct = $derived(
    data ? (data.span.durationMs > 0 ? Math.round((data.span.selfTimeMs / data.span.durationMs) * 100) : 100) : 100
  );
  let childPct = $derived(100 - selfPct);

  let showDistro = $derived(
    data ? data.similarSpans.count > 1 && data.similarSpans.maxMs > data.similarSpans.minMs : false
  );

  const actions = [
    { id: 'explain', icon: '💡', title: 'Explain This Span', desc: 'Ask the model what this span does and why it took this long' },
    { id: 'bottleneck', icon: '🐌', title: 'Find Bottlenecks', desc: 'Identify which child spans or self-time contribute most to latency' },
    { id: 'compare', icon: '📊', title: 'Compare Similar Spans', desc: '' },
    { id: 'chain', icon: '🔗', title: 'Analyze Call Chain', desc: 'Examine the full ancestry from root to this span for optimization opportunities' },
    { id: 'errors', icon: '🚨', title: 'Error Analysis', desc: 'Check for errors in this span and its descendants, suggest fixes' },
    { id: 'optimize', icon: '⚡', title: 'Suggest Optimizations', desc: 'Get concrete suggestions to reduce this span\'s duration' }
  ];

  let dynamicActions = $derived(
    data
      ? actions.map((a) =>
          a.id === 'compare'
            ? { ...a, desc: `Compare this span with ${data!.similarSpans.count - 1} other "${data!.span.name}" spans across all traces` }
            : a
        )
      : actions
  );

  async function submitAction(action: string) {
    if (!requestId || !data) return;

    const s = data.span;
    const context = [
      `Span: ${s.name} (${s.serviceName})`,
      `Duration: ${s.durationMs}ms (self: ${s.selfTimeMs}ms)`,
      `Status: ${s.statusCode === 2 ? 'ERROR' : 'OK'}`,
      `Children: ${data.children.length}`,
      `Similar spans: ${data.similarSpans.count} (avg ${data.similarSpans.avgMs}ms, rank ${data.similarSpans.thisRank}/${data.similarSpans.count})`,
      `Attributes: ${Object.entries(s.attributes).map(([k, v]) => `${k}=${v}`).join(', ')}`
    ].join('\n');

    submitted = true;

    try {
      await send('tools/call', {
        name: 'user-span-action',
        arguments: { requestId, action, context }
      });
    } catch (err) {
      console.error('Failed to submit action:', err);
    }
  }

  onMount(() => {
    on('ui/notifications/tool-input', async (params: any) => {
      requestId = params?.arguments?.requestId ?? null;
      const traceId = params?.arguments?.traceId;
      const spanId = params?.arguments?.spanId;
      if (traceId && spanId) {
        try {
          const result = await send('tools/call', {
            name: 'get-span-breakdown',
            arguments: { traceId, spanId }
          });
          if (result?.structuredContent?.span) {
            data = result.structuredContent;
            submitted = false;
          }
        } catch (err) {
          console.error('Failed to fetch span breakdown:', err);
        }
      }
    });

    on('ui/notifications/tool-result', (params: any) => {
      if (params?.structuredContent?.span) {
        data = params.structuredContent;
        submitted = false;
      }
    });

    on('ui/notifications/tool-input-partial', () => {});
    on('ui/notifications/host-context-changed', applyTheme);

    const cleanupResize = reportSize();

    initializeApp({ name: 'otel-span-breakdown', version: '0.1.0' }).then((result) => {
      if (result?.hostContext) applyTheme(result.hostContext);
    });

    return () => {
      cleanupResize();
      destroyMessageListener();
    };
  });
</script>

<h1>{data ? data.span.name : 'Span Breakdown'}</h1>
<div class="subtitle">
  {#if data}
    {data.span.serviceName} · {data.span.spanId} · {new Date(data.span.startTime).toLocaleString()}
  {/if}
</div>

{#if data}
  {@const s = data.span}
  {@const sim = data.similarSpans}
  {@const isErr = s.statusCode === 2}

  <div class="stats">
    <StatCard label="Duration" value={fmt(s.durationMs)} />
    <StatCard label="Self Time" value="{fmt(s.selfTimeMs)} ({selfPct}%)" />
    <StatCard label="Status" value={isErr ? 'ERROR' : 'OK'} variant={isErr ? 'error' : 'ok'} />
    <StatCard label="Kind" value={kindNames[s.kind] ?? s.kind} />
    <StatCard label="Children" value={data.children.length} />
    <StatCard label="Rank" value="{sim.thisRank}/{sim.count}" variant={sim.thisRank > sim.count * 0.9 ? 'warn' : 'default'} />
  </div>

  {#if !submitted}
    <div class="section">
      <h2>What would you like to do?</h2>
      <ActionCardGrid actions={dynamicActions} onaction={submitAction} />
    </div>
  {:else}
    <div class="submitted">✓ Action submitted — the model is processing your request.</div>
  {/if}

  <div class="section">
    <h2>Time Breakdown</h2>
    <TimingBar selfPct={selfPct} selfMs={s.selfTimeMs} childrenMs={s.durationMs - s.selfTimeMs} />
  </div>

  {#if data.callChain.length > 0}
    <div class="section">
      <h2>Call Chain</h2>
      <CallChain items={data.callChain} current={s.name} />
    </div>
  {/if}

  {#if showDistro}
    <div class="section">
      <h2>Compared to Similar Spans</h2>
      <DistributionPlot
        durations={sim.durations}
        currentMs={s.durationMs}
        minMs={sim.minMs}
        maxMs={sim.maxMs}
        avgMs={sim.avgMs}
        p50Ms={sim.p50Ms}
        p95Ms={sim.p95Ms}
        thisRank={sim.thisRank}
        count={sim.count}
      />
    </div>
  {/if}

  {#if data.children.length > 0}
    <div class="section">
      <h2>Child Spans</h2>
      <table>
        <thead><tr><th>Name</th><th>Service</th><th>Duration</th><th>Status</th></tr></thead>
        <tbody>
          {#each data.children as c}
            <tr>
              <td class="mono">{c.name}</td>
              <td class="mono">{c.serviceName}</td>
              <td class="mono">{fmt(c.durationMs)}</td>
              <td>
                {#if c.statusCode === 2}
                  <Badge type="err" />
                {:else}
                  <Badge type="ok" />
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  {#if Object.keys(s.attributes || {}).length > 0}
    <div class="section">
      <h2>Attributes</h2>
      <AttributeGrid attributes={s.attributes} />
    </div>
  {/if}
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
  .subtitle { font-size: 0.8rem; color: var(--color-text-secondary); font-family: var(--font-mono); margin-bottom: 16px; }
  h2 { font-size: 0.85rem; font-weight: 600; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px; }
  .section { margin-bottom: 20px; }

  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-bottom: 20px; }

  table { width: 100%; border-collapse: collapse; font-size: 0.82rem; }
  th { text-align: left; padding: 6px 8px; border-bottom: 2px solid var(--color-border-primary); color: var(--color-text-secondary); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; }
  td { padding: 5px 8px; border-bottom: 1px solid var(--color-border-primary); }
  .mono { font-family: var(--font-mono); font-size: 0.78rem; }

  .submitted { text-align: center; padding: 20px; color: var(--color-text-secondary); font-size: 0.9rem; }
</style>
