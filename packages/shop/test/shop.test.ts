import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createShop, ShopError } from "../src/client.ts";
import { buildWigQuery, toShopWig } from "../src/wigs.ts";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/search-wigs.json", import.meta.url), "utf8"));
const products = JSON.parse(fixture.result.content[0].text).products;

function fakeFetch(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
}

describe("shop client", () => {
  it("sends MCP 2026-07-28 stateless headers and _meta on every call", async () => {
    const fetch = fakeFetch(fixture);
    const shop = createShop({ fetch });
    await shop.call("search_catalog", { catalog: { query: "wig" } });
    const [url, init] = fetch.mock.calls[0]! as unknown as [string, RequestInit];
    expect(url).toBe("https://mcp.shop.com");
    const headers = new Headers(init.headers);
    expect(headers.get("MCP-Protocol-Version")).toBe("2026-07-28");
    expect(headers.get("Mcp-Method")).toBe("tools/call");
    expect(headers.get("Mcp-Name")).toBe("search_catalog");
    const body = JSON.parse(String(init.body));
    expect(body.params._meta["io.modelcontextprotocol/protocolVersion"]).toBe("2026-07-28");
    expect(body.params.name).toBe("search_catalog");
  });

  it("parses the text content of a tool result as JSON", async () => {
    const shop = createShop({ fetch: fakeFetch(fixture) });
    const res = (await shop.call("search_catalog", {})) as { products: unknown[] };
    expect(res.products).toHaveLength(6);
  });

  it("throws ShopError on JSON-RPC errors and tool errors", async () => {
    const rpc = createShop({ fetch: fakeFetch({ jsonrpc: "2.0", id: 1, error: { code: -32602, message: "bad" } }) });
    await expect(rpc.call("search_catalog", {})).rejects.toBeInstanceOf(ShopError);
    const tool = createShop({
      fetch: fakeFetch({ jsonrpc: "2.0", id: 1, result: { isError: true, content: [{ type: "text", text: "nope" }] } }),
    });
    await expect(tool.call("search_catalog", {})).rejects.toThrow(/nope/);
  });

  it("searchWigs maps products to candidates and dedupes by product", async () => {
    const shop = createShop({ fetch: fakeFetch(fixture) });
    const wigs = await shop.searchWigs({ colourWords: ["medium", "brown"], texture: null, medical: false });
    expect(wigs).toHaveLength(6);
    expect(wigs[0]?.imageUrl).toBe("https://cdn.example.com/wig-0.jpg");
  });

  it("prepareCheckout posts one line item to the seller's shop and returns continue_url", async () => {
    const fetch = fakeFetch({
      jsonrpc: "2.0",
      id: 3,
      result: { content: [{ type: "text", text: JSON.stringify({ id: "co1", status: "requires_escalation", continue_url: "https://shop1.example.com/checkouts/co1" }) }] },
    });
    const shop = createShop({ fetch });
    const r = await shop.prepareCheckout({ shopDomain: "shop1.myshopify.com", variantId: "gid://shopify/ProductVariant/1001" });
    expect(r).toEqual({ checkoutId: "co1", status: "requires_escalation", continueUrl: "https://shop1.example.com/checkouts/co1" });
    const args = JSON.parse(String((fetch.mock.calls[0]! as unknown as [string, RequestInit])[1].body)).params.arguments;
    expect(args.shop).toBe("shop1.myshopify.com");
    expect(args.checkout.line_items).toEqual([{ item: { id: "gid://shopify/ProductVariant/1001" }, quantity: 1 }]);
    expect(args.meta["idempotency-key"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});

describe("toShopWig", () => {
  it("reads colour, texture and length from the featured variant's options", () => {
    const w = toShopWig(products[1]);
    expect(w.colourName).toBe("#4 Chocolate Brown");
    expect(w.texture).toBe("Straight");
    expect(w.lengthIn).toBe(12);
    expect(w.variantId).toBe("gid://shopify/ProductVariant/1001");
    expect(w.shopDomain).toBe("shop1.myshopify.com");
    expect(w.priceMinor).toBe(13788);
    expect(w.measured).toBeNull();
  });

  it("falls back to the title for texture and colour", () => {
    const w = toShopWig(products[2]);
    expect(w.texture).toBe("body wave");
    expect(w.colourName).toBe("medium brown");
    expect(w.lengthIn).toBe(16);
  });

  it("parses lengths like 10inch(bob)", () => {
    expect(toShopWig(products[5]).lengthIn).toBe(10);
  });
});

describe("buildWigQuery", () => {
  it("builds a plain query with a medical-wig hint when asked", () => {
    expect(buildWigQuery({ colourWords: ["dark", "brown"], texture: "wavy", medical: true })).toBe("dark brown wavy medical wig");
    expect(buildWigQuery({ colourWords: ["blonde"], texture: null, medical: false })).toBe("blonde human hair wig");
  });
});
