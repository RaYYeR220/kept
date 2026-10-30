import { z } from "zod";
import { SHARE_UNAVAILABLE } from "@kept/likeness";
import { shares } from "@/lib/server/env";
import { allow } from "@/lib/server/ratelimit";
import { clientIp, json } from "@/lib/server/session";

export const runtime = "nodejs";

const Item = z.object({
  title: z.string().min(1).max(120),
  url: z.string().url().startsWith("https://").max(500).nullable(),
  imageUrl: z.string().url().startsWith("https://").max(500),
  hex: z.string().regex(/^#[0-9a-f]{6}$/i).nullable(),
  colourFamily: z.string().max(20).nullable(),
  source: z.string().max(60),
});

/** A wig specialist adds pieces from their own stock to a client's shared likeness. */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!allow(`inventory:${await clientIp()}`, 30, 60 * 60_000)) return json({ error: "Too many changes. Please wait a little." }, 429);
  const parsed = z.array(Item).max(20).safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Each item needs a title and an image link." }, 400);
  try {
    return json({ inventory: await shares().addInventory(token, parsed.data) });
  } catch {
    return json({ error: SHARE_UNAVAILABLE }, 410);
  }
}
