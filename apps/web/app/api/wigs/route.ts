import { rankWigs } from "@kept/likeness";
import { shop } from "@/lib/server/env";
import { asPersona, replayJson } from "@/lib/server/replay";
import { json } from "@/lib/server/session";
import { colourWords } from "@/lib/server/wigs";

export const runtime = "nodejs";

/** Live Shop Catalog search, ranked against the measured likeness sent in the query. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const hex = /^#[0-9a-f]{6}$/i.test(q.get("hex") ?? "") ? q.get("hex")! : null;
  const family = q.get("family");
  const texture = q.get("texture");
  const medical = q.get("medical") !== "0";
  const maxPrice = Number(q.get("maxUsd")) > 0 ? Math.round(Number(q.get("maxUsd")) * 100) : null;
  try {
    const wigs = await shop.searchWigs({ colourWords: colourWords(family), texture: null, medical });
    const affordable = maxPrice === null ? wigs : wigs.filter((w) => w.priceMinor !== null && w.priceMinor <= maxPrice);
    // Listings measured during a recorded demo session carry their YouCam reading.
    const recorded = q.get("mode") === "live" ? null : replayJson<Record<string, { hex: string; family: string; at: string }>>(asPersona(q.get("persona")), "listing-measurements");
    const withReadings = affordable.map((w) => {
      const r = recorded?.[w.listingId];
      return r ? { ...w, measured: { value: { hex: r.hex }, prov: { api: "skin-tone-analysis", version: "v2.0", taskId: null, units: 20, at: r.at, source: "replay" as const } } } : w;
    });
    const ranked = hex ? rankWigs({ hex, texture, lengthIn: null }, withReadings) : withReadings;
    return json({ wigs: ranked, query: { family, medical }, searchedAt: new Date().toISOString() });
  } catch (e) {
    return json({ error: "Couldn't reach the shop catalogue right now.", detail: (e as Error).message }, 502);
  }
}
