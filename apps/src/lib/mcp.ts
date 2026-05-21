// MCP App communication layer — JSON-RPC 2.0 over postMessage

type PendingRequest = {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
};

let nextId = 1;
const pending = new Map<number, PendingRequest>();
const handlers = new Map<string, (params: any) => void>();

export function send(method: string, params: any): Promise<any> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    window.parent.postMessage({ jsonrpc: '2.0', id, method, params }, '*');
  });
}

export function notify(method: string, params: any): void {
  window.parent.postMessage({ jsonrpc: '2.0', method, params }, '*');
}

export function on(method: string, fn: (params: any) => void): void {
  handlers.set(method, fn);
}

export function off(method: string): void {
  handlers.delete(method);
}

function handleMessage(e: MessageEvent) {
  const d = e.data;
  if (!d || d.jsonrpc !== '2.0') return;
  if (d.id && pending.has(d.id)) {
    const p = pending.get(d.id)!;
    pending.delete(d.id);
    d.error ? p.reject(d.error) : p.resolve(d.result);
  }
  if (d.method && handlers.has(d.method)) {
    handlers.get(d.method)!(d.params);
  }
}

let listenerAttached = false;

export function initMessageListener(): void {
  if (listenerAttached) return;
  listenerAttached = true;
  window.addEventListener('message', handleMessage);
}

export function destroyMessageListener(): void {
  window.removeEventListener('message', handleMessage);
  listenerAttached = false;
}

export interface InitOptions {
  name: string;
  version: string;
  capabilities?: Record<string, any>;
}

export async function initializeApp(opts: InitOptions): Promise<any> {
  initMessageListener();
  const result = await send('ui/initialize', {
    protocolVersion: '2026-01-26',
    capabilities: opts.capabilities ?? {},
    clientInfo: { name: opts.name, version: opts.version }
  });
  notify('ui/notifications/initialized', {});
  return result;
}

export function reportSize(): () => void {
  let lastW = 0;
  let lastH = 0;
  const observer = new ResizeObserver((entries) => {
    for (const e of entries) {
      const w = Math.ceil(e.contentRect.width);
      const h = Math.ceil(e.contentRect.height);
      if (w !== lastW || h !== lastH) {
        lastW = w;
        lastH = h;
        notify('ui/notifications/size-changed', { width: w, height: h });
      }
    }
  });
  observer.observe(document.body);
  return () => observer.disconnect();
}
