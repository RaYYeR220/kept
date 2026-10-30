import { shares } from "@/lib/server/env";
import { json } from "@/lib/server/session";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Daily: delete the photo and inventory of every expired or withdrawn share. */
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return json({ error: "Not found." }, 404);
  return json(await shares().sweep());
}
