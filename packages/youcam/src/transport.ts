import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// A fetch-shaped seam. Live calls go through `fetch`; tests and the demo personas use
// recorded responses keyed by request, so no units are spent replaying them.

export type Transport = (url: string, init: RequestInit) => Promise<Response>;

type Recorded = { status: number; body: unknown };

/** Stable key: method + path + canonical JSON body. Polling GETs get a per-key call index. */
export function requestKey(url: string, init: RequestInit): string {
  const u = new URL(url);
  const method = (init.method ?? "GET").toUpperCase();
  let body = "";
  if (typeof init.body === "string") {
    try {
      body = canonical(JSON.parse(init.body));
    } catch {
      body = init.body;
    }
  }
  return createHash("sha256").update(`${method} ${u.pathname}${u.search} ${body}`).digest("hex").slice(0, 24);
}

function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

export function recordingTransport(dir: string, inner: Transport = fetch): Transport {
  mkdirSync(dir, { recursive: true });
  return async (url, init) => {
    const res = await inner(url, init);
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* non-JSON bodies are stored as text */
    }
    const rec: Recorded = { status: res.status, body };
    writeFileSync(join(dir, `${requestKey(url, init)}.json`), JSON.stringify(rec, null, 1));
    return new Response(text, { status: res.status, headers: res.headers });
  };
}

export function replayTransport(dir: string): Transport {
  return async (url, init) => {
    const file = join(dir, `${requestKey(url, init)}.json`);
    if (!existsSync(file)) {
      return new Response(JSON.stringify({ status: 404, error: "not recorded", error_code: "NotRecorded" }), { status: 404 });
    }
    const rec = JSON.parse(readFileSync(file, "utf8")) as Recorded;
    return new Response(typeof rec.body === "string" ? rec.body : JSON.stringify(rec.body), { status: rec.status });
  };
}

/** In-memory transport for unit tests: route by "METHOD /path". */
export function scriptedTransport(routes: Record<string, Array<Recorded> | Recorded>): Transport & { calls: Array<{ url: string; init: RequestInit }> } {
  const queues = new Map(Object.entries(routes).map(([k, v]) => [k, Array.isArray(v) ? [...v] : [v]]));
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const t = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const u = new URL(url);
    const key = `${(init.method ?? "GET").toUpperCase()} ${u.hostname === "yce-api-01.makeupar.com" ? u.pathname : u.href}`;
    const q = queues.get(key);
    if (!q || q.length === 0) return new Response(JSON.stringify({ status: 404, error_code: "NoRoute", error: key }), { status: 404 });
    const rec = q.length > 1 ? q.shift()! : q[0]!;
    return new Response(JSON.stringify(rec.body), { status: rec.status });
  }) as Transport & { calls: Array<{ url: string; init: RequestInit }> };
  t.calls = calls;
  return t;
}
