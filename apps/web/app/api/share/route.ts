import { LikenessSchema, summarise } from "@kept/likeness";
import { shares } from "@/lib/server/env";
import { allow } from "@/lib/server/ratelimit";
import { clientIp, json, parseJson } from "@/lib/server/session";

export const runtime = "nodejs";

/** Creates a share link for a likeness. Measurements only, unless the person adds their photo. */
export async function POST(req: Request) {
  if (!allow(`share:${await clientIp()}`, 10, 60 * 60_000)) return json({ error: "Too many links for now. Please try again later." }, 429);
  const form = await req.formData();
  const parsed = LikenessSchema.safeParse(parseJson(form.get("likeness")));
  if (!parsed.success) return json({ error: "Nothing to share yet." }, 400);
  const photo = form.get("photo");
  const bytes = photo && typeof photo !== "string" && photo.size < 3_500_000 ? new Uint8Array(await photo.arrayBuffer()) : undefined;
  const label = String(form.get("label") ?? "").slice(0, 40) || null;
  const share = await shares().create({ summary: summarise(parsed.data), label, photo: bytes, ttlDays: 7 });
  return json({ token: share.token, expiresAt: share.expiresAt, photoShared: share.photoShared });
}
