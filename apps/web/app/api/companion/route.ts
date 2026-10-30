import { runCompanion, type ChatMsg, type CompanionTools } from "@kept/agent";
import { LikenessSchema, rankWigs, summarise, type TreatmentPlan } from "@kept/likeness";
import type { ShopWig } from "@kept/shop";
import { z } from "zod";
import { llm, shop, youcamFor } from "@/lib/server/env";
import { asPersona, replayImage, replayJson } from "@/lib/server/replay";
import { json, sessionId } from "@/lib/server/session";
import { renderBrows, renderHat, renderWig } from "@/lib/server/tryon";
import { colourWords } from "@/lib/server/wigs";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) })).min(1).max(30),
  likeness: LikenessSchema.nullable(),
  plan: z.object({ firstInfusion: z.string(), cycleDays: z.number().optional(), cycles: z.number().optional() }).nullable(),
  mode: z.enum(["live", "replay"]),
  persona: z.string().optional(),
  listings: z.array(z.object({ listingId: z.string(), imageUrl: z.string().url(), variantId: z.string(), shopDomain: z.string() })).max(40).default([]),
});

export async function POST(req: Request) {
  const form = await req.formData();
  const parsed = Body.safeParse(JSON.parse(String(form.get("body") ?? "{}")));
  if (!parsed.success) return json({ error: "Bad request." }, 400);
  const b = parsed.data;
  const sid = await sessionId();
  const persona = asPersona(b.persona);
  const photo = async (name: string) => {
    const f = form.get(name);
    return f && typeof f !== "string" ? new Uint8Array(await f.arrayBuffer()) : null;
  };
  const before = await photo("before");
  const today = (await photo("today")) ?? before;

  const known = new Map(b.listings.map((l) => [l.listingId, l]));
  const renders: Record<string, string> = {};
  const keep = (id: string, img: Uint8Array | null) => {
    if (img) renders[id] = Buffer.from(img).toString("base64");
    return id;
  };

  const today_ = new Date().toISOString().slice(0, 10);
  const inTreatment = Boolean(b.plan && b.plan.firstInfusion <= today_);
  const hair = b.likeness?.hair;

  const tools: CompanionTools = {
    async findWigs(q) {
      const wigs = await shop.searchWigs({ colourWords: q.colourFamily ? [q.colourFamily] : colourWords(hair?.color?.value.name ?? null), texture: q.texture ?? hair?.type?.value.term ?? null, medical: q.medical });
      const within = q.maxPriceMinor === null ? wigs : wigs.filter((w) => w.priceMinor !== null && w.priceMinor <= q.maxPriceMinor!);
      for (const w of within) known.set(w.listingId, { listingId: w.listingId, imageUrl: w.imageUrl, variantId: w.variantId, shopDomain: w.shopDomain });
      const target = { hex: hair?.color?.value.hex ?? "#000000", texture: hair?.type?.value.term ?? null, lengthIn: null };
      return rankWigs(target, within as ShopWig[]);
    },
    async tryOnWig(listingId) {
      const l = known.get(listingId);
      if (!l) throw new Error("Unknown listing");
      if (b.mode === "replay") return { renderId: keep(`wig-${listingId.slice(-12)}`, replayImage(persona, `wig-${listingId.replace(/[^a-z0-9]/gi, "").slice(-12)}`) ?? replayImage(persona, "wig")), units: 0 };
      if (!before) throw new Error("No before photo");
      const r = await renderWig(youcamFor("live", sid), before, l.imageUrl, sid);
      return { renderId: keep(`wig-${r.taskId}`, r.image), units: r.units };
    },
    async restoreBrows() {
      const brows = b.likeness?.brows;
      if (!brows?.color) throw new Error("No measured brows");
      if (b.mode === "replay") {
        const meta = replayJson<{ deltaE?: number }>(persona, "verify-brows");
        return { renderId: keep("brows", replayImage(persona, "brows")), units: 0, reMeasuredDeltaE: meta?.deltaE ?? null };
      }
      if (!today) throw new Error("No photo for today");
      const r = await renderBrows(youcamFor("live", sid), today, { hex: brows.color.value.hex, shape: brows.shape?.value ?? null }, sid);
      return { renderId: keep(`brows-${r.taskId}`, r.image), units: r.units, reMeasuredDeltaE: null };
    },
    async tryHeadwear(listingId) {
      const l = known.get(listingId);
      if (!l) throw new Error("Unknown listing");
      if (b.mode === "replay") return { renderId: keep("hat", replayImage(persona, "hat")), units: 0 };
      if (!today) throw new Error("No photo for today");
      const r = await renderHat(youcamFor("live", sid), today, l.imageUrl, "female", sid);
      return { renderId: keep(`hat-${r.taskId}`, r.image), units: r.units };
    },
    async findProducts(q) {
      const res = (await shop.call("search_catalog", { catalog: { query: q.query, filters: { available: true }, context: { address_country: "US" } } })) as {
        products?: Array<{ id: string; title: string; description?: { plain?: string }; variants?: Array<{ url?: string; price?: { amount: number; currency: string } }> }>;
      };
      return (res.products ?? []).slice(0, 8).map((p) => {
        const text = p.description?.plain ?? "";
        const inci = text.match(/ingredients?\s*:?\s*([^<]{20,800})/i)?.[1] ?? null;
        return {
          listingId: p.id,
          title: p.title,
          category: q.category,
          ingredients: q.category === "skincare" ? inci : null,
          attributes: [],
          priceMinor: p.variants?.[0]?.price?.amount ?? null,
          currency: p.variants?.[0]?.price?.currency ?? null,
          url: p.variants?.[0]?.url ?? "",
        };
      });
    },
    async prepareCheckout(listingId) {
      const l = known.get(listingId);
      if (!l) throw new Error("Unknown listing");
      return shop.prepareCheckout({ shopDomain: l.shopDomain, variantId: l.variantId });
    },
  };

  try {
    const { model, classifier } = llm();
    const turn = await runCompanion(
      { messages: b.messages as ChatMsg[], likeness: b.likeness ? summarise(b.likeness) : null, plan: b.plan as TreatmentPlan | null, inTreatment, today: today_ },
      { model, classifier, tools },
    );
    return json({ turn, renders, listings: [...known.values()] });
  } catch (e) {
    return json({ error: (e as Error).message }, 503);
  }
}
