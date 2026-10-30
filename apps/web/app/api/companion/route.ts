import { runCompanion, type ChatMsg, type CompanionTools } from "@kept/agent";
import { LikenessSchema, rankWigs, summarise, TreatmentPlanSchema, type ProductCategory, type TreatmentPlan } from "@kept/likeness";
import { allow } from "@/lib/server/ratelimit";
import type { ShopWig } from "@kept/shop";
import { z } from "zod";
import { llm, shop, youcamFor } from "@/lib/server/env";
import { asPersona, replayImage, replayJson, replayKey } from "@/lib/server/replay";
import { clientIp, json, parseJson, spendKey } from "@/lib/server/session";
import { calibrateBrows, renderHat, renderWig } from "@/lib/server/tryon";
import { colourWords } from "@/lib/server/wigs";

export const runtime = "nodejs";
export const maxDuration = 120;

const Body = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) })).min(1).max(30),
  likeness: LikenessSchema.nullable(),
  plan: TreatmentPlanSchema.nullable(),
  mode: z.enum(["live", "replay"]),
  persona: z.string().max(20).optional(),
  listings: z.array(z.object({ listingId: z.string().max(120), imageUrl: z.string().url().max(500), variantId: z.string().max(120), shopDomain: z.string().max(120) })).max(40).default([]),
});

/** The listing's own words decide which product rules apply, not the model's guess. */
function inferCategory(title: string, asked: ProductCategory): ProductCategory {
  const t = title.toLowerCase();
  if (/nail|polish|lacquer|manicure|gel kit|acrylic/.test(t)) return "nails";
  if (/cream|serum|lotion|cleanser|moistur|sunscreen|spf|toner|balm|oil\b|mask|ointment/.test(t)) return "skincare";
  if (/brow/.test(t)) return "brow";
  if (/wig\b|wigs\b/.test(t)) return "wig";
  if (/turban|beanie|scarf|cap\b|hat\b|headwrap|head wrap/.test(t)) return "headwear";
  return asked === "skincare" || asked === "nails" ? asked : "other";
}

export async function POST(req: Request) {
  if (!allow(`companion:${await clientIp()}`, 20, 10 * 60_000)) return json({ error: "Too many messages for now. Please wait a few minutes." }, 429);
  const form = await req.formData();
  const parsed = Body.safeParse(parseJson(form.get("body")));
  if (!parsed.success) return json({ error: "Bad request." }, 400);
  const b = parsed.data;
  const sid = await spendKey();
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
  // Without dates, assume treatment may have started: the stricter product rules apply.
  const inTreatment = !b.plan || b.plan.firstInfusion <= today_;
  const hair = b.likeness?.hair;

  const tools: CompanionTools = {
    async findWigs(q) {
      const wigs = await shop.searchWigs({ colourWords: q.colourFamily ? [q.colourFamily] : colourWords(hair?.color?.value.name ?? null), texture: q.texture ?? hair?.type?.value.term ?? null, medical: q.medical });
      const within = q.maxPriceMinor === null ? wigs : wigs.filter((w) => w.priceMinor !== null && w.priceMinor <= q.maxPriceMinor!);
      for (const w of within) known.set(w.listingId, { listingId: w.listingId, imageUrl: w.imageUrl, variantId: w.variantId, shopDomain: w.shopDomain });
      if (!hair?.color) return within.map((w) => ({ ...w, deltaE: null, band: "unmeasured" as const, textureMatch: null, reasons: ["No measured hair colour to compare with yet"] }));
      return rankWigs({ hex: hair.color.value.hex, texture: hair.type?.value.term ?? null, lengthIn: null }, within as ShopWig[]);
    },
    async tryOnWig(listingId) {
      const l = known.get(listingId);
      if (!l) throw new Error("Unknown listing");
      if (b.mode === "replay") return { renderId: keep(replayKey("wig", listingId), replayImage(persona, replayKey("wig", listingId))), units: 0 };
      if (!before) throw new Error("No before photo");
      const r = await renderWig(youcamFor("live", sid), before, l.imageUrl, sid);
      return { renderId: keep(`wig-${r.taskId}`, r.image), units: r.units };
    },
    async restoreBrows() {
      const brows = b.likeness?.brows;
      if (!brows?.color) throw new Error("No measured brows");
      if (b.mode === "replay") {
        const meta = replayJson<{ deltaE?: number }>(persona, "brows");
        return { renderId: keep("brows", replayImage(persona, "brows")), units: 0, reMeasuredDeltaE: meta?.deltaE ?? null };
      }
      if (!today) throw new Error("No photo for today");
      const c = await calibrateBrows(youcamFor("live", sid), today, { hex: brows.color.value.hex, shape: brows.shape?.value ?? null }, sid);
      return { renderId: keep(`brows-${Date.now()}`, c.best.image), units: c.units, reMeasuredDeltaE: c.best.deltaE };
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
          category: inferCategory(p.title, q.category),
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
    console.error("companion failed", e);
    return json({ error: "The Companion isn't available right now." }, 503);
  }
}
