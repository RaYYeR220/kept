import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import {
  buildTimeline,
  checkProduct,
  lookupStatus,
  SHARE_UNAVAILABLE,
  TIMELINE_DISCLAIMER,
  type RankedWig,
  type SharedLikeness,
} from "@kept/likeness";

// Kept's MCP server. Any MCP client (a wig specialist's assistant or a desktop AI app) can read
// a likeness the person shared, rank wigs against it, check products and plan the typical
// timeline. Access to a likeness is scoped by its share token; nothing else is exposed.

export type KeptMcpDeps = {
  getShare(token: string): Promise<SharedLikeness | null>;
  findWigs(share: SharedLikeness, q: { maxPriceMinor: number | null; medical: boolean }): Promise<RankedWig[]>;
  now?: () => string;
};

const text = (value: unknown) => ({ content: [{ type: "text" as const, text: typeof value === "string" ? value : JSON.stringify(value, null, 1) }] });
const fail = (message: string) => ({ ...text(message), isError: true });

export function createKeptMcpServer(deps: KeptMcpDeps): McpServer {
  const now = deps.now ?? (() => new Date().toISOString());
  const server = new McpServer({ name: "kept", version: "0.1.0" });

  async function resolve(token: string) {
    return lookupStatus(await deps.getShare(token), now());
  }

  server.registerTool(
    "likeness_summary",
    {
      title: "Shared likeness",
      description: "Measured hair, brow and skin values a person shared with you (no photos). Every value carries the YouCam API that measured it.",
      inputSchema: { share_token: z.string().min(8) },
      annotations: { readOnlyHint: true },
    },
    async ({ share_token }) => {
      const r = await resolve(share_token);
      if (r.status !== "ok") return fail(SHARE_UNAVAILABLE);
      return text({ label: r.share.label, measured: r.share.summary, expires_at: r.share.expiresAt });
    },
  );

  server.registerTool(
    "match_wigs",
    {
      title: "Match wigs to a shared likeness",
      description: "Search real wig listings and rank them against the shared likeness by measured colour family, texture and length.",
      inputSchema: { share_token: z.string().min(8), max_price_usd: z.number().positive().optional(), medical: z.boolean().optional() },
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ share_token, max_price_usd, medical }) => {
      const r = await resolve(share_token);
      if (r.status !== "ok") return fail(SHARE_UNAVAILABLE);
      const wigs = await deps.findWigs(r.share, { maxPriceMinor: max_price_usd ? Math.round(max_price_usd * 100) : null, medical: medical ?? true });
      return text(
        wigs.slice(0, 10).map((w) => ({ title: w.title, url: w.url, price_minor: w.priceMinor, currency: w.currency, colour_match: w.band, texture_match: w.textureMatch, reasons: w.reasons })),
      );
    },
  );

  server.registerTool(
    "check_product",
    {
      title: "Check a product",
      description: "Check a product's ingredients or type against Kept's cited cosmetic rules for people in treatment (fragrance, drying alcohol, actives, salon nails).",
      inputSchema: {
        title: z.string(),
        category: z.enum(["skincare", "nails", "brow", "wig", "headwear", "other"]),
        ingredients: z.string().nullable().optional(),
        in_treatment: z.boolean().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ title, category, ingredients, in_treatment }) =>
      text(checkProduct({ title, category, ingredients: ingredients ?? null, attributes: [] }, { inTreatment: in_treatment ?? true })),
  );

  server.registerTool(
    "typical_timeline",
    {
      title: "Typical appearance timeline",
      description: "When hair, brows and lashes typically change, from treatment dates. Cosmetic planning only.",
      inputSchema: {
        first_infusion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        cycle_days: z.number().int().min(7).max(60).optional(),
        cycles: z.number().int().min(1).max(30).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ first_infusion, cycle_days, cycles }) =>
      text({
        milestones: buildTimeline({ firstInfusion: first_infusion, cycleDays: cycle_days, cycles }, now().slice(0, 10)),
        note: TIMELINE_DISCLAIMER,
      }),
  );

  return server;
}

/** Stateless request handler for a web-standard route (e.g. a Next.js route handler). */
export async function handleMcpRequest(req: Request, deps: KeptMcpDeps): Promise<Response> {
  const server = createKeptMcpServer(deps);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(req);
}
