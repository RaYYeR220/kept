import { tool } from "ai";
import { z } from "zod";
import { BudgetError } from "@kept/youcam";
import {
  buildTimeline,
  checkProduct,
  type ProductCategory,
  type ProductFacts,
  type RankedWig,
  type TreatmentPlan,
} from "@kept/likeness";
import type { ReceiptLog } from "./receipts.ts";

// Tool inputs never carry a photo. The server resolves the person's photos from the
// session, so no image of the person can be passed to — or through — the model.

export type ProductHit = ProductFacts & { listingId: string; priceMinor: number | null; currency: string | null; url: string };

export type CompanionTools = {
  findWigs(q: { colourFamily: string | null; texture: string | null; maxPriceMinor: number | null; medical: boolean }): Promise<RankedWig[]>;
  tryOnWig(listingId: string): Promise<{ renderId: string; units: number }>;
  restoreBrows(): Promise<{ renderId: string; units: number; reMeasuredDeltaE: number | null }>;
  tryHeadwear(listingId: string): Promise<{ renderId: string; units: number }>;
  findProducts(q: { query: string; category: ProductCategory }): Promise<ProductHit[]>;
  prepareCheckout(listingId: string): Promise<{ continueUrl: string }>;
};

export type ToolContext = {
  impl: CompanionTools;
  log: ReceiptLog;
  plan: TreatmentPlan | null;
  today: string;
  inTreatment: boolean;
  /** Collected for the UI: render ids and checkout links produced this turn. */
  artifacts: { renders: string[]; checkouts: string[] };
  gatesOff?: boolean;
};

const short = (s: string, n = 120) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

async function guarded<T>(ctx: ToolContext, name: string, run: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await run();
  } catch (e) {
    if (e instanceof BudgetError) {
      ctx.log.gate("budget", e.message);
      return { error: e.message };
    }
    const msg = e instanceof Error ? e.message : String(e);
    ctx.log.tool(name, "error", msg);
    return { error: "That step didn't work this time." };
  }
}

export function buildTools(ctx: ToolContext) {
  return {
    get_timeline: tool({
      description: "The typical appearance timeline for this person's treatment dates (cosmetic planning only).",
      inputSchema: z.object({}).strict(),
      execute: async () => {
        if (!ctx.plan) return { note: "No treatment dates saved yet." };
        ctx.log.tool("get_timeline", "ok", "built from saved dates");
        return { milestones: buildTimeline(ctx.plan, ctx.today) };
      },
    }),

    find_wigs: tool({
      description: "Search real wig listings and rank them against the person's measured likeness.",
      inputSchema: z
        .object({
          colour_family: z.string().nullable().describe("e.g. 'brown'; null to use the measured family"),
          texture: z.string().nullable(),
          max_price_usd: z.number().positive().nullable(),
          medical: z.boolean().describe("prefer medical/comfort-cap wigs"),
        })
        .strict(),
      execute: async (a) =>
        guarded(ctx, "find_wigs", async () => {
          const wigs = await ctx.impl.findWigs({
            colourFamily: a.colour_family,
            texture: a.texture,
            maxPriceMinor: a.max_price_usd === null ? null : Math.round(a.max_price_usd * 100),
            medical: a.medical,
          });
          ctx.log.tool("find_wigs", "ok", `${wigs.length} listings ranked`);
          return wigs.slice(0, 6).map((w) => ({
            listing_id: w.listingId,
            title: short(w.title),
            price: w.priceMinor === null ? null : `${(w.priceMinor / 100).toFixed(2)} ${w.currency ?? ""}`.trim(),
            colour_match: w.band,
            reasons: w.reasons,
          }));
        }),
    }),

    try_on_wig: tool({
      description: "Render a listed wig on the person's own 'before' photo.",
      inputSchema: z.object({ listing_id: z.string() }).strict(),
      execute: async ({ listing_id }) =>
        guarded(ctx, "try_on_wig", async () => {
          const r = await ctx.impl.tryOnWig(listing_id);
          ctx.artifacts.renders.push(r.renderId);
          ctx.log.tool("try_on_wig", "ok", `rendered ${listing_id}`, r.units);
          return { rendered: true, shown_to_person: true };
        }),
    }),

    restore_brows: tool({
      description: "Draw the person's brows and lashes back in their own measured colour and shape on today's photo.",
      inputSchema: z.object({}).strict(),
      execute: async () =>
        guarded(ctx, "restore_brows", async () => {
          const r = await ctx.impl.restoreBrows();
          ctx.artifacts.renders.push(r.renderId);
          ctx.log.tool("restore_brows", "ok", r.reMeasuredDeltaE === null ? "rendered" : `rendered; re-measured ΔE ${r.reMeasuredDeltaE.toFixed(1)}`, r.units);
          return { rendered: true, shown_to_person: true, re_measured_delta_e: r.reMeasuredDeltaE };
        }),
    }),

    try_headwear: tool({
      description: "Render a listed hat, cap or turban on the person's photo.",
      inputSchema: z.object({ listing_id: z.string() }).strict(),
      execute: async ({ listing_id }) =>
        guarded(ctx, "try_headwear", async () => {
          const r = await ctx.impl.tryHeadwear(listing_id);
          ctx.artifacts.renders.push(r.renderId);
          ctx.log.tool("try_headwear", "ok", `rendered ${listing_id}`, r.units);
          return { rendered: true, shown_to_person: true };
        }),
    }),

    find_products: tool({
      description: "Search skincare, nail or brow products. Every result is checked against Kept's product rules first.",
      inputSchema: z
        .object({ query: z.string().min(2), category: z.enum(["skincare", "nails", "brow", "headwear", "other"]) })
        .strict(),
      execute: async ({ query, category }) =>
        guarded(ctx, "find_products", async () => {
          const hits = await ctx.impl.findProducts({ query, category });
          const shown = [];
          for (const h of hits) {
            const v = checkProduct(h, { inTreatment: ctx.inTreatment });
            if (v.status === "blocked" && !ctx.gatesOff) {
              ctx.log.gate("product", `${short(h.title, 60)}: ${v.findings.map((f) => f.ruleId).join(", ")}`);
              continue;
            }
            shown.push({ listing_id: h.listingId, title: short(h.title), status: v.status, notes: v.findings.map((f) => f.message) });
          }
          ctx.log.tool("find_products", "ok", `${shown.length} of ${hits.length} shown`);
          return shown;
        }),
    }),

    check_product: tool({
      description: "Check a product's ingredients or type against Kept's cited product rules.",
      inputSchema: z
        .object({
          title: z.string(),
          category: z.enum(["skincare", "nails", "brow", "wig", "headwear", "other"]),
          ingredients: z.string().nullable(),
        })
        .strict(),
      execute: async (p) => {
        const v = checkProduct({ ...p, attributes: [] }, { inTreatment: ctx.inTreatment });
        ctx.log.tool("check_product", "ok", `${short(p.title, 60)} → ${v.status}`);
        return v;
      },
    }),

    prepare_checkout: tool({
      description: "Prepare a review-and-pay link at the store. The person reviews and pays there; Kept never pays.",
      inputSchema: z.object({ listing_id: z.string() }).strict(),
      execute: async ({ listing_id }) =>
        guarded(ctx, "prepare_checkout", async () => {
          const r = await ctx.impl.prepareCheckout(listing_id);
          ctx.artifacts.checkouts.push(r.continueUrl);
          ctx.log.tool("prepare_checkout", "ok", "review-and-pay link prepared");
          return { link_shown_to_person: true };
        }),
    }),
  };
}
