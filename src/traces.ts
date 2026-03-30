// ---------------------------------------------------------------------------
// Trace analysis helpers for OTLP JSONL data
// ---------------------------------------------------------------------------

/** Raw OTLP attribute */
interface OtlpAttribute {
  key: string;
  value: { stringValue?: string; intValue?: string; boolValue?: boolean; doubleValue?: number };
}

/** A flattened span for easy processing */
export interface FlatSpan {
  traceId: string;
  spanId: string;
  parentSpanId: string;
  name: string;
  kind: number;
  startTimeNano: bigint;
  endTimeNano: bigint;
  durationMs: number;
  statusCode: number;
  serviceName: string;
  attributes: Record<string, string>;
}

/** Per-trace summary */
export interface TraceSummary {
  traceId: string;
  rootSpanName: string;
  serviceName: string;
  spanCount: number;
  durationMs: number;
  errorCount: number;
  startTime: string; // ISO
  services: string[];
}

/** Overall dashboard data */
export interface DashboardData {
  totalTraces: number;
  totalSpans: number;
  services: { name: string; spanCount: number; errorCount: number }[];
  spanNames: { name: string; count: number; avgDurationMs: number; p99DurationMs: number }[];
  errorRate: number;
  latencyPercentiles: { p50: number; p95: number; p99: number };
  traces: TraceSummary[];
}

/** Detail view for a single trace */
export interface TraceDetail {
  traceId: string;
  rootSpanName: string;
  durationMs: number;
  startTime: string;
  spanCount: number;
  errorCount: number;
  services: string[];
  spans: {
    spanId: string;
    parentSpanId: string;
    name: string;
    serviceName: string;
    startOffsetMs: number;
    durationMs: number;
    statusCode: number;
    kind: number;
    attributes: Record<string, string>;
  }[];
}

function attrValue(attr: OtlpAttribute): string {
  const v = attr.value;
  return v.stringValue ?? v.intValue ?? String(v.doubleValue ?? v.boolValue ?? "");
}

/** Flatten all OTLP JSONL entries into FlatSpans */
export function flattenSpans(rawEntries: unknown[]): FlatSpan[] {
  const spans: FlatSpan[] = [];

  for (const entry of rawEntries) {
    const e = entry as any;
    if (!e?.resourceSpans) continue;

    for (const rs of e.resourceSpans) {
      const resourceAttrs = rs.resource?.attributes ?? [];
      const serviceName =
        resourceAttrs.find((a: OtlpAttribute) => a.key === "service.name")?.value?.stringValue ?? "unknown";

      for (const ss of rs.scopeSpans ?? []) {
        for (const span of ss.spans ?? []) {
          const startNano = BigInt(span.startTimeUnixNano ?? "0");
          const endNano = BigInt(span.endTimeUnixNano ?? "0");
          const attrs: Record<string, string> = {};
          for (const a of span.attributes ?? []) {
            attrs[a.key] = attrValue(a);
          }

          spans.push({
            traceId: span.traceId ?? "",
            spanId: span.spanId ?? "",
            parentSpanId: span.parentSpanId ?? "",
            name: span.name ?? "",
            kind: span.kind ?? 0,
            startTimeNano: startNano,
            endTimeNano: endNano,
            durationMs: Number(endNano - startNano) / 1e6,
            statusCode: span.status?.code ?? 0,
            serviceName,
            attributes: attrs,
          });
        }
      }
    }
  }

  return spans;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

/** Build dashboard summary from flat spans */
export function buildDashboard(spans: FlatSpan[]): DashboardData {
  // Group by trace
  const traceMap = new Map<string, FlatSpan[]>();
  for (const s of spans) {
    let arr = traceMap.get(s.traceId);
    if (!arr) { arr = []; traceMap.set(s.traceId, arr); }
    arr.push(s);
  }

  // Per-service stats
  const serviceMap = new Map<string, { spanCount: number; errorCount: number }>();
  for (const s of spans) {
    let svc = serviceMap.get(s.serviceName);
    if (!svc) { svc = { spanCount: 0, errorCount: 0 }; serviceMap.set(s.serviceName, svc); }
    svc.spanCount++;
    if (s.statusCode === 2) svc.errorCount++;
  }

  // Per-span-name stats
  const nameMap = new Map<string, number[]>();
  for (const s of spans) {
    let arr = nameMap.get(s.name);
    if (!arr) { arr = []; nameMap.set(s.name, arr); }
    arr.push(s.durationMs);
  }

  const spanNames = Array.from(nameMap.entries())
    .map(([name, durations]) => {
      durations.sort((a, b) => a - b);
      return {
        name,
        count: durations.length,
        avgDurationMs: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length * 100) / 100,
        p99DurationMs: Math.round(percentile(durations, 99) * 100) / 100,
      };
    })
    .sort((a, b) => b.count - a.count);

  // Per-trace summaries
  const traces: TraceSummary[] = [];
  const traceDurations: number[] = [];
  let totalErrors = 0;

  for (const [traceId, traceSpans] of traceMap) {
    const root = traceSpans.find(s => !s.parentSpanId) ?? traceSpans[0];
    const minStart = traceSpans.reduce((m, s) => s.startTimeNano < m ? s.startTimeNano : m, traceSpans[0].startTimeNano);
    const maxEnd = traceSpans.reduce((m, s) => s.endTimeNano > m ? s.endTimeNano : m, traceSpans[0].endTimeNano);
    const durationMs = Number(maxEnd - minStart) / 1e6;
    const errorCount = traceSpans.filter(s => s.statusCode === 2).length;
    const services = [...new Set(traceSpans.map(s => s.serviceName))];

    totalErrors += errorCount;
    traceDurations.push(durationMs);

    traces.push({
      traceId,
      rootSpanName: root.name,
      serviceName: root.serviceName,
      spanCount: traceSpans.length,
      durationMs: Math.round(durationMs * 100) / 100,
      errorCount,
      startTime: new Date(Number(minStart / BigInt(1e6))).toISOString(),
      services,
    });
  }

  traces.sort((a, b) => b.durationMs - a.durationMs);
  traceDurations.sort((a, b) => a - b);

  return {
    totalTraces: traceMap.size,
    totalSpans: spans.length,
    services: Array.from(serviceMap.entries())
      .map(([name, s]) => ({ name, ...s }))
      .sort((a, b) => b.spanCount - a.spanCount),
    spanNames: spanNames.slice(0, 25),
    errorRate: spans.length > 0 ? Math.round((totalErrors / spans.length) * 10000) / 100 : 0,
    latencyPercentiles: {
      p50: Math.round(percentile(traceDurations, 50) * 100) / 100,
      p95: Math.round(percentile(traceDurations, 95) * 100) / 100,
      p99: Math.round(percentile(traceDurations, 99) * 100) / 100,
    },
    traces,
  };
}

/** Build detail view for a single trace */
export function buildTraceDetail(spans: FlatSpan[], traceId: string): TraceDetail | null {
  const traceSpans = spans.filter(s => s.traceId === traceId);
  if (traceSpans.length === 0) return null;

  const root = traceSpans.find(s => !s.parentSpanId) ?? traceSpans[0];
  const minStart = traceSpans.reduce((m, s) => s.startTimeNano < m ? s.startTimeNano : m, traceSpans[0].startTimeNano);
  const maxEnd = traceSpans.reduce((m, s) => s.endTimeNano > m ? s.endTimeNano : m, traceSpans[0].endTimeNano);
  const durationMs = Number(maxEnd - minStart) / 1e6;
  const services = [...new Set(traceSpans.map(s => s.serviceName))];

  // Sort spans: root first, then by start time
  const sorted = [...traceSpans].sort((a, b) => {
    if (!a.parentSpanId) return -1;
    if (!b.parentSpanId) return 1;
    return Number(a.startTimeNano - b.startTimeNano);
  });

  // Build tree-ordered list (DFS from root)
  const childMap = new Map<string, FlatSpan[]>();
  for (const s of sorted) {
    const pid = s.parentSpanId || "__root__";
    let children = childMap.get(pid);
    if (!children) { children = []; childMap.set(pid, children); }
    children.push(s);
  }

  const ordered: FlatSpan[] = [];
  function dfs(spanId: string) {
    const children = childMap.get(spanId) ?? [];
    for (const child of children) {
      ordered.push(child);
      dfs(child.spanId);
    }
  }
  // Start from root
  if (root && !root.parentSpanId) {
    ordered.push(root);
    dfs(root.spanId);
  } else {
    // No clear root, use all sorted by start time
    ordered.push(...sorted);
  }

  // Fill in any spans we missed (shouldn't happen, but defensive)
  const seen = new Set(ordered.map(s => s.spanId));
  for (const s of sorted) {
    if (!seen.has(s.spanId)) ordered.push(s);
  }

  return {
    traceId,
    rootSpanName: root.name,
    durationMs: Math.round(durationMs * 100) / 100,
    startTime: new Date(Number(minStart / BigInt(1e6))).toISOString(),
    spanCount: traceSpans.length,
    errorCount: traceSpans.filter(s => s.statusCode === 2).length,
    services,
    spans: ordered.map(s => ({
      spanId: s.spanId,
      parentSpanId: s.parentSpanId,
      name: s.name,
      serviceName: s.serviceName,
      startOffsetMs: Math.round(Number(s.startTimeNano - minStart) / 1e6 * 100) / 100,
      durationMs: Math.round(s.durationMs * 100) / 100,
      statusCode: s.statusCode,
      kind: s.kind,
      attributes: s.attributes,
    })),
  };
}

/** Span breakdown for the inspect-span tool */
export interface SpanBreakdown {
  span: {
    spanId: string;
    traceId: string;
    parentSpanId: string;
    name: string;
    serviceName: string;
    durationMs: number;
    selfTimeMs: number;
    statusCode: number;
    kind: number;
    startTime: string;
    attributes: Record<string, string>;
  };
  parent: { spanId: string; name: string; serviceName: string; durationMs: number } | null;
  children: { spanId: string; name: string; serviceName: string; durationMs: number; statusCode: number }[];
  /** Durations of all spans with the same name, sorted ascending */
  similarSpans: {
    count: number;
    avgMs: number;
    minMs: number;
    maxMs: number;
    p50Ms: number;
    p95Ms: number;
    thisRank: number; // 1-based position of this span in the sorted list
    durations: number[];
  };
  /** Ancestor chain from root down to this span */
  callChain: { spanId: string; name: string; serviceName: string; durationMs: number }[];
}

/** Build a breakdown for a single span */
export function buildSpanBreakdown(allSpans: FlatSpan[], traceId: string, spanId: string): SpanBreakdown | null {
  const span = allSpans.find(s => s.traceId === traceId && s.spanId === spanId);
  if (!span) return null;

  const traceSpans = allSpans.filter(s => s.traceId === traceId);
  const spanMap = new Map(traceSpans.map(s => [s.spanId, s]));

  // Children
  const children = traceSpans
    .filter(s => s.parentSpanId === spanId)
    .sort((a, b) => Number(a.startTimeNano - b.startTimeNano));

  // Self time = total duration minus children's duration (clamped to 0)
  const childrenTotalMs = children.reduce((sum, c) => sum + c.durationMs, 0);
  const selfTimeMs = Math.max(0, span.durationMs - childrenTotalMs);

  // Parent
  const parentSpan = span.parentSpanId ? spanMap.get(span.parentSpanId) ?? null : null;

  // Call chain (ancestors root → ... → parent)
  const callChain: SpanBreakdown["callChain"] = [];
  let cur = span;
  while (cur.parentSpanId) {
    const p = spanMap.get(cur.parentSpanId);
    if (!p) break;
    callChain.unshift({
      spanId: p.spanId,
      name: p.name,
      serviceName: p.serviceName,
      durationMs: Math.round(p.durationMs * 100) / 100,
    });
    cur = p;
  }

  // Similar spans (same name across all traces)
  const similar = allSpans.filter(s => s.name === span.name);
  const durations = similar.map(s => s.durationMs).sort((a, b) => a - b);
  const thisRank = durations.filter(d => d <= span.durationMs).length;

  return {
    span: {
      spanId: span.spanId,
      traceId: span.traceId,
      parentSpanId: span.parentSpanId,
      name: span.name,
      serviceName: span.serviceName,
      durationMs: Math.round(span.durationMs * 100) / 100,
      selfTimeMs: Math.round(selfTimeMs * 100) / 100,
      statusCode: span.statusCode,
      kind: span.kind,
      startTime: new Date(Number(span.startTimeNano / BigInt(1e6))).toISOString(),
      attributes: span.attributes,
    },
    parent: parentSpan ? {
      spanId: parentSpan.spanId,
      name: parentSpan.name,
      serviceName: parentSpan.serviceName,
      durationMs: Math.round(parentSpan.durationMs * 100) / 100,
    } : null,
    children: children.map(c => ({
      spanId: c.spanId,
      name: c.name,
      serviceName: c.serviceName,
      durationMs: Math.round(c.durationMs * 100) / 100,
      statusCode: c.statusCode,
    })),
    similarSpans: {
      count: durations.length,
      avgMs: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length * 100) / 100,
      minMs: Math.round((durations[0] ?? 0) * 100) / 100,
      maxMs: Math.round((durations[durations.length - 1] ?? 0) * 100) / 100,
      p50Ms: Math.round(percentile(durations, 50) * 100) / 100,
      p95Ms: Math.round(percentile(durations, 95) * 100) / 100,
      thisRank,
      durations: durations.slice(0, 200), // cap for transport size
    },
    callChain,
  };
}

// ---------------------------------------------------------------------------
// Deep analysis — configurable via elicitation
// ---------------------------------------------------------------------------

export interface DeepAnalysisConfig {
  /** Analysis focus: "latency" | "errors" | "outliers" | "dependencies" */
  focus: string;
  /** Only flag spans slower than this (ms). 0 = auto-detect. */
  latencyThresholdMs: number;
  /** Max results to return */
  maxResults: number;
}

export interface DeepAnalysisResult {
  config: DeepAnalysisConfig;
  summary: string;
  findings: {
    severity: "info" | "warning" | "critical";
    title: string;
    detail: string;
    spanName?: string;
    traceId?: string;
    spanId?: string;
    durationMs?: number;
  }[];
  operationStats: {
    name: string;
    count: number;
    avgMs: number;
    p95Ms: number;
    maxMs: number;
    errorCount: number;
    outlierCount: number;
  }[];
}

export function buildDeepAnalysis(spans: FlatSpan[], config: DeepAnalysisConfig): DeepAnalysisResult {
  const findings: DeepAnalysisResult["findings"] = [];

  // Group spans by name
  const byName = new Map<string, FlatSpan[]>();
  for (const s of spans) {
    let arr = byName.get(s.name);
    if (!arr) { arr = []; byName.set(s.name, arr); }
    arr.push(s);
  }

  // Per-operation stats
  const operationStats: DeepAnalysisResult["operationStats"] = [];
  for (const [name, group] of byName) {
    const durations = group.map(s => s.durationMs).sort((a, b) => a - b);
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const p95 = percentile(durations, 95);
    const max = durations[durations.length - 1] ?? 0;
    const errorCount = group.filter(s => s.statusCode === 2).length;

    // Determine threshold: explicit or auto (2× avg or p95, whichever is larger)
    const threshold = config.latencyThresholdMs > 0
      ? config.latencyThresholdMs
      : Math.max(avg * 2, p95);
    const outliers = group.filter(s => s.durationMs > threshold);

    operationStats.push({
      name,
      count: group.length,
      avgMs: round(avg),
      p95Ms: round(p95),
      maxMs: round(max),
      errorCount,
      outlierCount: outliers.length,
    });

    // Generate findings based on focus
    if (config.focus === "latency" || config.focus === "outliers") {
      for (const s of outliers.slice(0, 3)) {
        findings.push({
          severity: s.durationMs > threshold * 3 ? "critical" : "warning",
          title: `Slow ${name}`,
          detail: `${round(s.durationMs)}ms (threshold: ${round(threshold)}ms, avg: ${round(avg)}ms — ${round(s.durationMs / avg)}× slower than average)`,
          spanName: name,
          traceId: s.traceId,
          spanId: s.spanId,
          durationMs: round(s.durationMs),
        });
      }
    }

    if (config.focus === "errors" || config.focus === "outliers") {
      if (errorCount > 0) {
        const errorRate = round((errorCount / group.length) * 100);
        findings.push({
          severity: errorRate > 50 ? "critical" : errorRate > 10 ? "warning" : "info",
          title: `Errors in ${name}`,
          detail: `${errorCount}/${group.length} calls failed (${errorRate}% error rate)`,
          spanName: name,
        });
      }
    }

    if (config.focus === "dependencies") {
      // Look for high fan-out: spans that often have many children
      const childCounts = group.map(s => {
        return spans.filter(c => c.parentSpanId === s.spanId && c.traceId === s.traceId).length;
      });
      const avgChildren = childCounts.reduce((a, b) => a + b, 0) / childCounts.length;
      if (avgChildren > 3) {
        findings.push({
          severity: avgChildren > 10 ? "warning" : "info",
          title: `High fan-out: ${name}`,
          detail: `Averages ${round(avgChildren)} child spans per call — potential parallelization opportunity or excessive decomposition`,
          spanName: name,
        });
      }
    }
  }

  // Sort operations by impact
  operationStats.sort((a, b) => (b.avgMs * b.count) - (a.avgMs * a.count));

  // Sort findings by severity
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  findings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  // Cap findings
  const capped = findings.slice(0, config.maxResults);

  const focusLabel = { latency: "Latency", errors: "Error", outliers: "Outlier", dependencies: "Dependency" }[config.focus] ?? config.focus;
  const critCount = capped.filter(f => f.severity === "critical").length;
  const warnCount = capped.filter(f => f.severity === "warning").length;
  const summary = `${focusLabel} analysis: ${capped.length} findings (${critCount} critical, ${warnCount} warnings) across ${operationStats.length} operations`;

  return { config, summary, findings: capped, operationStats: operationStats.slice(0, 20) };
}

function round(n: number): number { return Math.round(n * 100) / 100; }
