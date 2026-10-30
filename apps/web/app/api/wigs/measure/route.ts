import { z } from "zod";
import { liveAvailable, youcamLive } from "@/lib/server/env";
import { sampleHair, type HairSample } from "@/lib/server/sample";
import { json, sessionId } from "@/lib/server/session";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({ listings: z.array(z.object({ listingId: z.string(), imageUrl: z.string().url() })).min(1).max(10) });

// Derived readings only (a colour per image URL), never the images themselves.
const cache = new Map<string, { sample: HairSample | null; at: string }>();

/**
 * Reads the hair shade on each listing photo the same way Kept reads the person's: YouCam's
 * free pre-process finds the face, Kept samples the band above it. Costs no units.
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Up to 10 listings with image links." }, 400);
  if (!liveAvailable()) return json({ error: "Measuring is switched off on this deployment." }, 503);
  const yc = youcamLive();
  const sid = await sessionId();
  const queue = [...parsed.data.listings];
  const results: Record<string, { hex: string; name: string; at: string } | null> = {};
  async function worker() {
    for (let l = queue.shift(); l; l = queue.shift()) {
      try {
        let hit = cache.get(l.imageUrl);
        if (!hit) {
          const res = await fetch(l.imageUrl);
          if (!res.ok) throw new Error(String(res.status));
          hit = { sample: await sampleHair(yc, new Uint8Array(await res.arrayBuffer()), sid, true), at: new Date().toISOString() };
          cache.set(l.imageUrl, hit);
        }
        results[l.listingId] = hit.sample ? { hex: hit.sample.hex, name: hit.sample.name, at: hit.at } : null;
      } catch {
        results[l.listingId] = null;
      }
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  return json({ results });
}
