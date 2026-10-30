import { buildWigQuery, toShopWig, type ShopWig, type WigQuery } from "./wigs.ts";

// Minimal client for Shop MCP (https://mcp.shop.com), which speaks the stateless
// MCP 2026-07-28 transport: no session, method and tool name in headers, protocol
// details in each request's _meta.

export const SHOP_MCP_URL = "https://mcp.shop.com";
const PROTOCOL = "2026-07-28";

export class ShopError extends Error {
  constructor(message: string, readonly code: number | null = null) {
    super(message);
    this.name = "ShopError";
  }
}

export type ShopOptions = {
  endpoint?: string;
  fetch?: typeof fetch;
  clientName?: string;
};

export type CheckoutHandoff = { checkoutId: string; status: string; continueUrl: string };

type RpcResponse = {
  error?: { code: number; message: string };
  result?: { isError?: boolean; content?: Array<{ type: string; text?: string }> };
};

async function readRpc(res: Response): Promise<RpcResponse> {
  const text = await res.text();
  if ((res.headers.get("content-type") ?? "").includes("text/event-stream")) {
    const data = text
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .at(-1);
    if (!data) throw new ShopError("Empty event stream from Shop MCP");
    return JSON.parse(data) as RpcResponse;
  }
  try {
    return JSON.parse(text) as RpcResponse;
  } catch {
    throw new ShopError(`Shop MCP returned ${res.status}: ${text.slice(0, 200)}`);
  }
}

export function createShop(opts: ShopOptions = {}) {
  const endpoint = opts.endpoint ?? SHOP_MCP_URL;
  const doFetch = opts.fetch ?? fetch;
  const clientInfo = { name: opts.clientName ?? "kept", version: "0.1.0" };
  let nextId = 1;

  async function call(tool: string, args: object): Promise<unknown> {
    const res = await doFetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": PROTOCOL,
        "Mcp-Method": "tools/call",
        "Mcp-Name": tool,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: nextId++,
        method: "tools/call",
        params: {
          name: tool,
          arguments: args,
          _meta: {
            "io.modelcontextprotocol/protocolVersion": PROTOCOL,
            "io.modelcontextprotocol/clientCapabilities": {},
            "io.modelcontextprotocol/clientInfo": clientInfo,
          },
        },
      }),
    });
    const rpc = await readRpc(res);
    if (rpc.error) throw new ShopError(rpc.error.message, rpc.error.code);
    const text = rpc.result?.content?.find((c) => c.type === "text")?.text ?? "";
    if (rpc.result?.isError) throw new ShopError(text || `Shop MCP tool ${tool} failed`);
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  async function searchWigs(q: WigQuery & { country?: string }): Promise<ShopWig[]> {
    const res = (await call("search_catalog", {
      catalog: {
        query: buildWigQuery(q),
        filters: { available: true },
        context: { address_country: q.country ?? "US", intent: "wig for hair loss during treatment" },
      },
    })) as { products?: unknown[] };
    const seen = new Set<string>();
    const wigs: ShopWig[] = [];
    for (const p of res.products ?? []) {
      const w = toShopWig(p as Parameters<typeof toShopWig>[0]);
      if (seen.has(w.listingId)) continue;
      seen.add(w.listingId);
      wigs.push(w);
    }
    return wigs;
  }

  async function prepareCheckout(input: { shopDomain: string; variantId: string; quantity?: number }): Promise<CheckoutHandoff> {
    const res = (await call("create_checkout", {
      shop: input.shopDomain,
      checkout: { line_items: [{ item: { id: input.variantId }, quantity: input.quantity ?? 1 }] },
      meta: { "idempotency-key": crypto.randomUUID() },
    })) as { id?: string; status?: string; continue_url?: string };
    if (!res.id || !res.continue_url) throw new ShopError("Checkout response had no id or continue_url");
    return { checkoutId: res.id, status: res.status ?? "unknown", continueUrl: res.continue_url };
  }

  return { call, searchWigs, prepareCheckout };
}

export type Shop = ReturnType<typeof createShop>;
