import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { createServer as createHttpServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve, isAbsolute } from "node:path";
import { existsSync } from "node:fs";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import express, { type Request, type Response } from "express";
import cors from "cors";

import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { isInitializeRequest, ElicitResultSchema } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import { flattenSpans, buildDashboard, buildTraceDetail, buildSpanBreakdown, type FlatSpan } from "./traces.js";

const execFileAsync = promisify(execFile);

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC_DIR = resolve(__dirname, "..", "public");
const MCP_PORT = process.env.MCP_PORT ? parseInt(process.env.MCP_PORT, 10) : 3000;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

/** Session ID → transport */
const transports = new Map<string, StreamableHTTPServerTransport>();

/** Session ID → loaded trace lines */
const traceData = new Map<string, unknown[]>();

/** Session ID → cached flat spans */
const flatSpanCache = new Map<string, FlatSpan[]>();

/** Elicitation ID → resolver + data store */
const pendingElicitations = new Map<
  string,
  {
    resolve: () => void;
    data?: { lineCount: number; spanCount: number; fileName: string };
  }
>();

/**
 * Pending span actions: "Using UI Data in Tool Call Responses" pattern for span inspection.
 * requestId → resolver called by the app-only tool when the user picks an analysis action.
 */
const pendingSpanActions = new Map<
  string,
  { resolve: (value: { action: string; context: string }) => void }
>();

/** Token → export JSON string (one-time download tokens) */
const pendingExports = new Map<string, string>();

/** Helper to get or compute flat spans for a session */
function getSpans(sessionId: string): FlatSpan[] {
  let spans = flatSpanCache.get(sessionId);
  if (!spans) {
    const raw = traceData.get(sessionId);
    if (!raw) return [];
    spans = flattenSpans(raw);
    flatSpanCache.set(sessionId, spans);
  }
  return spans;
}

// ---------------------------------------------------------------------------
// MCP Server factory (one per session)
// ---------------------------------------------------------------------------

function createServer(): McpServer {
  const server = new McpServer(
    { name: "otel-mcp-explorer", version: "0.1.0" },
    { capabilities: { logging: {} } },
  );

  // -- load-traces tool ---------------------------------------------------
  server.registerTool(
    "load-traces",
    {
      title: "Load Traces",
      description:
        "Opens a visual form to select a local or remote traces.jsonl file and loads it into memory for exploration.",
    },
    async (extra) => {
      const sessionId = extra.sessionId;
      if (!sessionId) {
        return {
          content: [{ type: "text", text: "Error: no session ID available." }],
          isError: true,
        };
      }

      const elicitationId = randomUUID();
      const url = `http://localhost:${MCP_PORT}/select-source?session=${encodeURIComponent(sessionId)}&elicitation=${encodeURIComponent(elicitationId)}`;

      // Create a promise that will resolve when the form is submitted
      const elicitationDone = new Promise<void>((res) => {
        pendingElicitations.set(elicitationId, { resolve: res });
      });

      // Send the URL-mode elicitation to the client
      const result = await extra.sendRequest(
        {
          method: "elicitation/create" as any,
          params: {
            mode: "url" as const,
            message:
              "Please select a data source for OpenTelemetry traces. A browser window will open with a form to choose a local file path or a remote SCP target.",
            elicitationId,
            url,
          },
        },
        ElicitResultSchema,
      );

      if ((result as any).action !== "accept") {
        pendingElicitations.delete(elicitationId);
        return {
          content: [
            { type: "text", text: "Data source selection was cancelled." },
          ],
        };
      }

      // Wait for the form POST to complete the elicitation
      await elicitationDone;

      const info = pendingElicitations.get(elicitationId)?.data;
      pendingElicitations.delete(elicitationId);

      if (!info) {
        return {
          content: [
            {
              type: "text",
              text: "Elicitation completed but no trace data was loaded.",
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Loaded **${info.fileName}**: ${info.lineCount} lines, ${info.spanCount} spans. Data is now available for exploration.`,
          },
        ],
      };
    },
  );

  // -- UI Resources -------------------------------------------------------

  const UI_MIME = "text/html;profile=mcp-app";

  server.registerResource(
    "trace-dashboard",
    "ui://otel/trace-dashboard",
    { title: "Trace Dashboard", description: "Interactive OTel trace overview dashboard", mimeType: UI_MIME },
    async () => ({
      contents: [{
        uri: "ui://otel/trace-dashboard",
        mimeType: UI_MIME,
        text: await readFile(resolve(PUBLIC_DIR, "trace-dashboard.html"), "utf-8"),
      }],
    }),
  );

  server.registerResource(
    "trace-detail",
    "ui://otel/trace-detail",
    { title: "Trace Detail", description: "Trace waterfall / Gantt chart", mimeType: UI_MIME },
    async () => ({
      contents: [{
        uri: "ui://otel/trace-detail",
        mimeType: UI_MIME,
        text: await readFile(resolve(PUBLIC_DIR, "trace-detail.html"), "utf-8"),
      }],
    }),
  );

  server.registerResource(
    "span-breakdown",
    "ui://otel/span-breakdown",
    { title: "Span Breakdown", description: "Deep-dive analysis of a single span", mimeType: UI_MIME },
    async () => ({
      contents: [{
        uri: "ui://otel/span-breakdown",
        mimeType: UI_MIME,
        text: await readFile(resolve(PUBLIC_DIR, "span-breakdown.html"), "utf-8"),
      }],
    }),
  );

  // -- show-traces tool (model-visible, linked to dashboard app) ----------

  server.registerTool(
    "show-traces",
    {
      title: "Show Traces Dashboard",
      description: "Displays an interactive dashboard of loaded OpenTelemetry trace data. Shows service breakdown, latency percentiles, top operations, and a trace list.",
      _meta: {
        ui: { resourceUri: "ui://otel/trace-dashboard" },
      },
    },
    async (extra) => {
      const sessionId = extra.sessionId;
      if (!sessionId) return { content: [{ type: "text", text: "No session." }], isError: true };

      const spans = getSpans(sessionId);
      if (spans.length === 0) {
        return { content: [{ type: "text", text: "No trace data loaded. Use the load-traces tool first." }], isError: true };
      }

      const dashboard = buildDashboard(spans);

      // Text fallback for non-Apps hosts
      const lines = [
        `## Trace Dashboard`,
        `- **${dashboard.totalTraces}** traces, **${dashboard.totalSpans}** spans`,
        `- Error rate: **${dashboard.errorRate}%**`,
        `- Latency — p50: ${dashboard.latencyPercentiles.p50}ms, p95: ${dashboard.latencyPercentiles.p95}ms, p99: ${dashboard.latencyPercentiles.p99}ms`,
        ``,
        `### Services`,
        ...dashboard.services.map(s => `- ${s.name}: ${s.spanCount} spans, ${s.errorCount} errors`),
        ``,
        `### Top Operations`,
        ...dashboard.spanNames.slice(0, 10).map(s => `- ${s.name}: ${s.count}× avg ${s.avgDurationMs}ms`),
      ];

      return {
        content: [{ type: "text", text: lines.join("\n") }],
        structuredContent: dashboard as any,
      };
    },
  );

  // -- export-traces (app-only, generates downloadable JSON) ----------------

  server.registerTool(
    "export-traces",
    {
      title: "Export Traces",
      description: "Generates a JSON export of the loaded trace data and opens a download link.",
      _meta: {
        ui: {
          resourceUri: "ui://otel/trace-dashboard",
          visibility: ["app"],
        },
      },
    },
    async (extra) => {
      const sessionId = extra.sessionId;
      if (!sessionId) return { content: [{ type: "text", text: "No session." }], isError: true };

      const spans = getSpans(sessionId);
      if (spans.length === 0) {
        return { content: [{ type: "text", text: "No trace data loaded." }], isError: true };
      }

      const dashboard = buildDashboard(spans);

      // Store export under a one-time token
      const token = randomUUID();
      const exportData = JSON.stringify({
        exportedAt: new Date().toISOString(),
        ...dashboard,
      }, null, 2);
      pendingExports.set(token, exportData);
      // Auto-expire after 5 minutes
      setTimeout(() => pendingExports.delete(token), 5 * 60 * 1000);

      const downloadUrl = `http://localhost:${MCP_PORT}/api/export/${token}`;

      return {
        content: [{ type: "text", text: `Export ready: ${downloadUrl}` }],
        structuredContent: { downloadUrl } as any,
      };
    },
  );

  // -- deep-analysis (app-only, uses MCP sampling) ------------------------

  server.registerTool(
    "deep-analysis",
    {
      title: "Deep Analysis",
      description: "Computes trace statistics, then uses MCP sampling to ask the client LLM for a deep performance analysis. Returns structured findings.",
      _meta: {
        ui: {
          resourceUri: "ui://otel/trace-dashboard",
          visibility: ["app"],
        },
      },
    },
    async (extra) => {
      const sessionId = extra.sessionId;
      if (!sessionId) return { content: [{ type: "text", text: "No session." }], isError: true };

      const spans = getSpans(sessionId);
      if (spans.length === 0) {
        return { content: [{ type: "text", text: "No trace data loaded." }], isError: true };
      }

      const dashboard = buildDashboard(spans);

      // Build a detailed summary of the trace data for the LLM
      const dataContext = [
        `You are analyzing OpenTelemetry trace data. Respond ONLY with a valid JSON object (no markdown fences). The JSON must have this exact shape:`,
        `{"summary":"one-line summary","findings":[{"severity":"critical|warning|info","title":"short title","detail":"explanation"}]}`,
        ``,
        `Here is the data:`,
        `- ${dashboard.totalTraces} traces, ${dashboard.totalSpans} spans`,
        `- Error rate: ${dashboard.errorRate}%`,
        `- Latency: p50=${dashboard.latencyPercentiles.p50}ms, p95=${dashboard.latencyPercentiles.p95}ms, p99=${dashboard.latencyPercentiles.p99}ms`,
        ``,
        `Services:`,
        ...dashboard.services.map(s => `- ${s.name}: ${s.spanCount} spans, ${s.errorCount} errors`),
        ``,
        `Top operations (by total time):`,
        ...dashboard.spanNames.slice(0, 20).map(s =>
          `- "${s.name}": ${s.count} calls, avg ${s.avgDurationMs}ms, p99 ${s.p99DurationMs}ms`
        ),
        ``,
        `Slowest traces:`,
        ...dashboard.traces
          .sort((a, b) => b.durationMs - a.durationMs)
          .slice(0, 10)
          .map(t => `- ${t.rootSpanName} (${t.traceId.slice(0, 8)}…): ${t.durationMs}ms, ${t.spanCount} spans, ${t.errorCount} errors`),
        ``,
        `Analyze for: performance bottlenecks, error patterns, outlier operations, optimization opportunities.`,
        `Return 5-15 findings sorted by severity (critical first). Be specific, reference operation names and numbers.`,
      ].join("\n");

      // Use MCP sampling to get the LLM's analysis
      const samplingResult = await server.server.createMessage({
        messages: [
          {
            role: "user",
            content: { type: "text", text: dataContext },
          },
        ],
        maxTokens: 2000,
      });

      // Parse the LLM response
      const responseText = samplingResult.content.type === "text"
        ? samplingResult.content.text
        : "";

      let analysis: { summary: string; findings: { severity: string; title: string; detail: string }[] };
      try {
        analysis = JSON.parse(responseText);
      } catch {
        // If parsing fails, wrap the raw text as a single finding
        analysis = {
          summary: "LLM analysis complete",
          findings: [{ severity: "info", title: "Analysis", detail: responseText }],
        };
      }

      const textLines = [
        `## Deep Analysis: ${analysis.summary}`,
        ``,
        ...analysis.findings.map(f =>
          `- **[${f.severity.toUpperCase()}]** ${f.title}: ${f.detail}`
        ),
      ];

      return {
        content: [{ type: "text", text: textLines.join("\n") }],
        structuredContent: {
          summary: analysis.summary,
          findings: analysis.findings,
          model: samplingResult.model,
        } as any,
      };
    },
  );

  // -- inspect-span (model-visible, "UI Data in Tool Call Responses") -----

  server.registerTool(
    "inspect-span",
    {
      title: "Inspect Span",
      description: "Shows a detailed breakdown of a single span — timing, self-time, children, similar spans comparison, call chain — and lets the user choose an analysis action. Returns the user's chosen action.",
      inputSchema: {
        requestId: z.string().describe("Unique ID for this inspection request"),
        traceId: z.string().describe("The trace ID containing the span"),
        spanId: z.string().describe("The span ID to inspect"),
      },
      _meta: {
        ui: { resourceUri: "ui://otel/span-breakdown" },
      },
    },
    async ({ requestId, traceId, spanId }, extra) => {
      const sessionId = extra.sessionId;
      if (!sessionId) return { content: [{ type: "text", text: "No session." }], isError: true };

      const spans = getSpans(sessionId);
      const breakdown = buildSpanBreakdown(spans, traceId, spanId);
      if (!breakdown) {
        return { content: [{ type: "text", text: `Span ${spanId} not found in trace ${traceId}.` }], isError: true };
      }

      // Wait for the user to pick an action in the UI
      const userAction = await new Promise<{ action: string; context: string }>((resolve) => {
        pendingSpanActions.set(requestId, { resolve });
      });
      pendingSpanActions.delete(requestId);

      // Build a rich text response that incorporates both the breakdown data and the user's action
      const s = breakdown.span;
      const lines = [
        `## Span Inspection: ${s.name}`,
        `- **Service:** ${s.serviceName}`,
        `- **Duration:** ${s.durationMs}ms (self: ${s.selfTimeMs}ms)`,
        `- **Status:** ${s.statusCode === 2 ? "ERROR" : "OK"}`,
        `- **Children:** ${breakdown.children.length}`,
        `- **Similar spans across dataset:** ${breakdown.similarSpans.count} (avg ${breakdown.similarSpans.avgMs}ms, this is rank ${breakdown.similarSpans.thisRank}/${breakdown.similarSpans.count})`,
        ``,
        `### User requested action: ${userAction.action}`,
        userAction.context ? `Context: ${userAction.context}` : "",
      ];

      return {
        content: [{ type: "text", text: lines.join("\n") }],
        structuredContent: {
          ...breakdown,
          userAction: userAction.action,
          userActionContext: userAction.context,
        } as any,
      };
    },
  );

  // -- user-span-action (app-only, resolves inspect-span) -----------------

  server.registerTool(
    "user-span-action",
    {
      title: "User Span Action",
      description: "Called by the span breakdown UI when the user picks an analysis action. Resolves the pending inspect-span request.",
      inputSchema: {
        requestId: z.string().describe("The requestId from the inspect-span call"),
        action: z.string().describe("The analysis action the user chose"),
        context: z.string().describe("Additional context for the action").default(""),
      },
      _meta: {
        ui: {
          resourceUri: "ui://otel/span-breakdown",
          visibility: ["app"],
        },
      },
    },
    async ({ requestId, action, context }) => {
      const pending = pendingSpanActions.get(requestId);
      if (pending) {
        pending.resolve({ action, context });
        pendingSpanActions.delete(requestId);
        return { content: [{ type: "text", text: "Action submitted." }] };
      }
      return { content: [{ type: "text", text: "No pending inspection request found." }], isError: true };
    },
  );

  // -- show-trace-detail (model-visible, waterfall view) ------------------

  server.registerTool(
    "show-trace-detail",
    {
      title: "Show Trace Detail",
      description: "Renders a detailed waterfall / Gantt chart view of a single trace's spans.",
      inputSchema: {
        traceId: z.string().describe("The trace ID to display"),
      },
      _meta: {
        ui: { resourceUri: "ui://otel/trace-detail" },
      },
    },
    async ({ traceId }, extra) => {
      const sessionId = extra.sessionId;
      if (!sessionId) return { content: [{ type: "text", text: "No session." }], isError: true };

      const spans = getSpans(sessionId);
      const detail = buildTraceDetail(spans, traceId);

      if (!detail) {
        return { content: [{ type: "text", text: `Trace ${traceId} not found.` }], isError: true };
      }

      // Text fallback
      const lines = [
        `## Trace ${traceId.slice(0, 8)}…`,
        `- Root: **${detail.rootSpanName}**`,
        `- Duration: **${detail.durationMs}ms**`,
        `- Spans: **${detail.spanCount}**, Errors: **${detail.errorCount}**`,
        `- Services: ${detail.services.join(", ")}`,
        ``,
        `### Spans`,
        ...detail.spans.map(s => `- ${s.name} (${s.durationMs}ms) ${s.statusCode === 2 ? "❌" : "✓"}`),
      ];

      return {
        content: [{ type: "text", text: lines.join("\n") }],
        structuredContent: detail as any,
      };
    },
  );

  return server;
}

// ---------------------------------------------------------------------------
// Express app
// ---------------------------------------------------------------------------

const app = createMcpExpressApp();

app.use(
  cors({
    exposedHeaders: [
      "Mcp-Session-Id",
      "Last-Event-Id",
      "Mcp-Protocol-Version",
    ],
    origin: "*",
  }),
);

// Serve the HTML form
app.use("/select-source", express.static(PUBLIC_DIR + "/select-source.html"));

// Parse JSON bodies for our API route
app.use("/api", express.json());

// ---------------------------------------------------------------------------
// GET /api/export/:token — one-time download of exported trace data
// ---------------------------------------------------------------------------

app.get("/api/export/:token", (req: Request, res: Response) => {
  const token = Array.isArray(req.params.token) ? req.params.token[0] : req.params.token;
  const data = pendingExports.get(token);
  if (!data) {
    res.status(404).json({ error: "Export not found or expired." });
    return;
  }
  pendingExports.delete(token); // one-time use
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="traces-export-${token.slice(0, 8)}.json"`);
  res.send(data);
});

// ---------------------------------------------------------------------------
// POST /api/select-source — receives form submission
// ---------------------------------------------------------------------------

app.post("/api/select-source", async (req: Request, res: Response) => {
  const { type, localPath, remoteHost, remoteUser, remotePath, sessionId, elicitationId } =
    req.body ?? {};

  if (!sessionId || !elicitationId) {
    res.status(400).json({ ok: false, error: "Missing sessionId or elicitationId." });
    return;
  }

  try {
    let fileContent: string;
    let fileName: string;

    if (type === "local") {
      if (!localPath || typeof localPath !== "string") {
        res.status(400).json({ ok: false, error: "Missing local file path." });
        return;
      }

      // Security: resolve and validate path
      const resolved = resolve(localPath);
      if (!isAbsolute(resolved)) {
        res.status(400).json({ ok: false, error: "Invalid path." });
        return;
      }
      if (!existsSync(resolved)) {
        res.status(400).json({ ok: false, error: `File not found: ${resolved}` });
        return;
      }

      fileContent = await readFile(resolved, "utf-8");
      fileName = resolved;
    } else if (type === "remote") {
      if (!remoteHost || typeof remoteHost !== "string") {
        res.status(400).json({ ok: false, error: "Missing remote host." });
        return;
      }
      if (!remotePath || typeof remotePath !== "string") {
        res.status(400).json({ ok: false, error: "Missing remote file path." });
        return;
      }

      // Validate host/user/path don't contain shell-dangerous characters
      const safePattern = /^[a-zA-Z0-9._\-@/:~]+$/;
      const user = (remoteUser && typeof remoteUser === "string") ? remoteUser : "root";

      if (!safePattern.test(remoteHost) || !safePattern.test(user) || !safePattern.test(remotePath)) {
        res.status(400).json({ ok: false, error: "Invalid characters in host, username, or path." });
        return;
      }

      const tmpPath = join(tmpdir(), `otel-traces-${randomUUID()}.jsonl`);
      const scpTarget = `${user}@${remoteHost}:${remotePath}`;

      try {
        await execFileAsync("scp", [
          "-o", "StrictHostKeyChecking=accept-new",
          "-o", "ConnectTimeout=15",
          scpTarget,
          tmpPath,
        ], { timeout: 60_000 });
      } catch (err: any) {
        res.status(500).json({
          ok: false,
          error: `SCP failed: ${err.stderr || err.message}`,
        });
        return;
      }

      fileContent = await readFile(tmpPath, "utf-8");
      fileName = scpTarget;
    } else {
      res.status(400).json({ ok: false, error: "Invalid type. Use 'local' or 'remote'." });
      return;
    }

    // Parse JSONL
    const lines = fileContent
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const parsed: unknown[] = [];
    let spanCount = 0;

    for (const line of lines) {
      try {
        const obj = JSON.parse(line);
        parsed.push(obj);
        // Count spans across resourceSpans → scopeSpans → spans
        if (obj?.resourceSpans) {
          for (const rs of obj.resourceSpans) {
            for (const ss of rs.scopeSpans ?? []) {
              spanCount += ss.spans?.length ?? 0;
            }
          }
        }
      } catch {
        // skip malformed lines
      }
    }

    // Store data for this session
    traceData.set(sessionId, parsed);
    flatSpanCache.delete(sessionId); // invalidate cache

    // Resolve the pending elicitation
    const pending = pendingElicitations.get(elicitationId);
    if (pending) {
      pending.data = { lineCount: lines.length, spanCount, fileName };
      pending.resolve();
    }

    // Also notify the MCP client that the URL elicitation is complete
    const transport = transports.get(sessionId);
    if (transport) {
      // Find the Server instance and send completion notification
      // We access the underlying server via the transport's connected server
    }

    res.json({
      ok: true,
      message: `Loaded ${lines.length} lines with ${spanCount} spans from ${fileName}. You can close this tab.`,
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ---------------------------------------------------------------------------
// MCP endpoints: POST, GET, DELETE on /mcp
// ---------------------------------------------------------------------------

app.post("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  try {
    if (sessionId && transports.has(sessionId)) {
      const transport = transports.get(sessionId)!;
      await transport.handleRequest(req, res, req.body);
      return;
    }

    if (!sessionId && isInitializeRequest(req.body)) {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          transports.set(sid, transport);
        },
      });

      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid) {
          transports.delete(sid);
          traceData.delete(sid);
          flatSpanCache.delete(sid);
        }
      };

      const server = createServer();
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      return;
    }

    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Bad Request: No valid session ID" },
      id: null,
    });
  } catch (error) {
    console.error("Error handling POST /mcp:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal Server Error" },
        id: null,
      });
    }
  }
});

app.get("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !transports.has(sessionId)) {
    res.status(400).send("Invalid or missing session ID");
    return;
  }
  const transport = transports.get(sessionId)!;
  await transport.handleRequest(req, res);
});

app.delete("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  if (!sessionId || !transports.has(sessionId)) {
    res.status(400).send("Invalid session ID");
    return;
  }
  const transport = transports.get(sessionId)!;
  await transport.handleRequest(req, res);
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

const httpServer = createHttpServer(app);

httpServer.listen(MCP_PORT, "127.0.0.1", () => {
  console.log(`OTel MCP Explorer listening on http://127.0.0.1:${MCP_PORT}/mcp`);
  console.log(`Select-source form at http://127.0.0.1:${MCP_PORT}/select-source`);
});

httpServer.on("error", (err) => {
  console.error("HTTP server error:", err);
  process.exit(1);
});

process.on("SIGINT", async () => {
  console.log("\nShutting down…");
  for (const [sid, transport] of transports) {
    try {
      await transport.close();
    } catch {}
    transports.delete(sid);
  }
  httpServer.close();
  process.exit(0);
});
