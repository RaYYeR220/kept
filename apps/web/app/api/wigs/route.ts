import { rankWigs } from "@kept/likeness";
import { shop } from "@/lib/server/env";
import { recordedListings } from "@/lib/server/replay";
import { toShopWig } from "@kept/shop";
import { json } from "@/lib/server/session";
import { colourWords, textureWord } from "@/lib/server/wigs";

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
    const wigs = await shop.searchWigs({ colourWords: colourWords(family), texture: texture ? textureWord(texture) : null, medical });
    const affordable = maxPrice === null ? wigs : wigs.filter((w) => w.priceMinor !== null && w.priceMinor <= maxPrice);
    // In the demo, the listings that have a recorded try-on come first, with live details.
    let pinned: typeof wigs = [];
    if (q.get("mode") !== "live") {
      const ids = recordedListings(q.get("persona"));
      if (ids.length) {
        const found = (await shop.call("lookup_catalog", { catalog: { ids, context: { address_country: "US" } } })) as { products?: Parameters<typeof toShopWig>[0][] };
        pinned = (found.products ?? []).map((p) => ({ ...toShopWig(p), recordedTryOn: true }));
      }
    }
    const withReadings = [...pinned, ...affordable.filter((w) => !pinned.some((p) => p.listingId === w.listingId))];
    const ranked = hex ? rankWigs({ hex, texture, lengthIn: null }, withReadings) : withReadings;
    return json({ wigs: ranked, query: { family, medical }, searchedAt: new Date().toISOString() });
  } catch (e) {
    console.error(e);
    return json({ error: "Couldn't reach the shop catalogue right now." }, 502);
  }
}
