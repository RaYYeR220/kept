import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { SharedLikeness } from "@kept/likeness";
import { createKeptMcpServer, handleMcpRequest, type KeptMcpDeps } from "../src/server.ts";

const prov = { api: "face-attr-analysis", version: "v2.0", taskId: "t", units: 10, at: "2026-10-31T10:00:00Z", source: "replay" as const };
const share = (over: Partial<SharedLikeness> = {}): SharedLikeness => ({
  token: "tok-12345678",
  summary: {
    id: "l1",
    createdAt: "2026-10-31T10:00:00Z",
    status: "complete",
    hair: { color: { value: { hex: "#42280e", name: "Brown" }, prov }, type: null, length: null, density: null, frizz: null },
    brows: { color: { value: { hex: "#4a3222" }, prov }, shape: { value: { shape: "Soft Angled", thickness: "Average" }, prov } },
    skin: { tone: { value: { hex: "#c99d7f" }, prov }, fitzpatrick: null, baseline: null },
    eyes: null,
    lips: null,
    face: null,
  },
  createdAt: "2026-10-31T10:00:00Z",
  expiresAt: "2026-11-07T10:00:00Z",
  revoked: false,
  photoShared: false,
  label: "Anna",
  ...over,
});

function deps(s: SharedLikeness | null): KeptMcpDeps {
  return {
    getShare: async (t) => (s && s.token === t ? s : null),
    findWigs: async () => [],
    now: () => "2026-11-01T00:00:00Z",
  };
}

async function connect(d: KeptMcpDeps) {
  const server = createKeptMcpServer(d);
  const [a, b] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "1" });
  await Promise.all([server.connect(a), client.connect(b)]);
  return client;
}

const firstText = (r: Awaited<ReturnType<Client["callTool"]>>) => (r.content as Array<{ type: string; text: string }>)[0]!.text;

describe("Kept MCP server", () => {
  it("lists the four tools", async () => {
    const client = await connect(deps(share()));
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(["check_product", "likeness_summary", "match_wigs", "typical_timeline"]);
  });

  it("returns the measured summary for a live token", async () => {
    const client = await connect(deps(share()));
    const r = await client.callTool({ name: "likeness_summary", arguments: { share_token: "tok-12345678" } });
    expect(r.isError).toBeFalsy();
    expect(JSON.parse(firstText(r)).measured.brows.color.value.hex).toBe("#4a3222");
  });

  it.each([
    ["expired", share({ expiresAt: "2026-10-31T23:00:00Z" })],
    ["revoked", share({ revoked: true })],
    ["missing", null],
  ])("refuses a %s share", async (_, s) => {
    const client = await connect(deps(s));
    const r = await client.callTool({ name: "likeness_summary", arguments: { share_token: "tok-12345678" } });
    expect(r.isError).toBe(true);
    expect(firstText(r)).toMatch(/expired or was withdrawn/);
  });

  it("check_product matches the core rules", async () => {
    const client = await connect(deps(null));
    const r = await client.callTool({ name: "check_product", arguments: { title: "Water-based lacquer", category: "nails", ingredients: null } });
    expect(JSON.parse(firstText(r)).status).toBe("ok");
    const r2 = await client.callTool({ name: "check_product", arguments: { title: "Acrylic nail set", category: "nails" } });
    expect(JSON.parse(firstText(r2)).status).toBe("blocked");
  });

  it("typical_timeline returns four milestones with the disclaimer", async () => {
    const client = await connect(deps(null));
    const r = await client.callTool({ name: "typical_timeline", arguments: { first_infusion: "2026-11-03" } });
    const body = JSON.parse(firstText(r));
    expect(body.milestones).toHaveLength(4);
    expect(body.note).toMatch(/1,478/);
  });

  it("serves JSON-RPC over a stateless web request", async () => {
    const req = new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: { name: "t", version: "1" } } }),
    });
    const res = await handleMcpRequest(req, deps(null));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.result.serverInfo.name).toBe("kept");
  });
});
