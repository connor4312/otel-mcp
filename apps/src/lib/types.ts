export interface TraceSummary {
  traceId: string;
  rootSpanName: string;
  serviceName: string;
  spanCount: number;
  durationMs: number;
  errorCount: number;
  startTime: string;
  services: string[];
}

export interface DashboardData {
  totalTraces: number;
  totalSpans: number;
  services: { name: string; spanCount: number; errorCount: number }[];
  spanNames: { name: string; count: number; avgDurationMs: number; p99DurationMs: number }[];
  errorRate: number;
  latencyPercentiles: { p50: number; p95: number; p99: number };
  traces: TraceSummary[];
}

export interface TraceDetailSpan {
  spanId: string;
  parentSpanId: string;
  name: string;
  serviceName: string;
  startOffsetMs: number;
  durationMs: number;
  statusCode: number;
  kind: number;
  attributes: Record<string, string>;
}

export interface TraceDetail {
  traceId: string;
  rootSpanName: string;
  durationMs: number;
  startTime: string;
  spanCount: number;
  errorCount: number;
  services: string[];
  spans: TraceDetailSpan[];
}

export interface SpanBreakdownData {
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
  similarSpans: {
    count: number;
    avgMs: number;
    minMs: number;
    maxMs: number;
    p50Ms: number;
    p95Ms: number;
    thisRank: number;
    durations: number[];
  };
  callChain: { spanId: string; name: string; serviceName: string; durationMs: number }[];
}

export interface ExampleSpan {
  traceId: string;
  spanId: string;
  name: string;
  serviceName: string;
  durationMs: number;
}

export interface AnalysisResult {
  summary: string;
  findings: { severity: string; title: string; detail: string; exampleSpan?: ExampleSpan }[];
  model?: string;
  config?: { focus?: string };
}
