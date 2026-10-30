// Fixed-window rate limits per key, per server instance. Enough to stop one client
// from turning the free endpoints into a bill; the unit ledger and credit floor guard spend.
const windows = new Map<string, { start: number; count: number }>();

export function allow(key: string, max: number, windowMs: number, now = Date.now()): boolean {
  const w = windows.get(key);
  if (!w || now - w.start >= windowMs) {
    windows.set(key, { start: now, count: 1 });
    if (windows.size > 5000) for (const [k, v] of windows) if (now - v.start >= windowMs) windows.delete(k);
    return true;
  }
  if (w.count >= max) return false;
  w.count++;
  return true;
}
