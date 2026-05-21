export function fmt(ms: number): string {
  return ms >= 1000 ? (ms / 1000).toFixed(2) + 's' : ms.toFixed(1) + 'ms';
}
