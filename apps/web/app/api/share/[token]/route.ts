import { SHARE_UNAVAILABLE } from "@kept/likeness";
import { shares } from "@/lib/server/env";
import { json } from "@/lib/server/session";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const l = await shares().get(token);
  if (l.status !== "ok") return json({ error: SHARE_UNAVAILABLE, status: l.status }, 410);
  const inventory = await shares().listInventory(token);
  return json({ share: l.share, inventory });
}

/** The person withdraws the link: photo and inventory are deleted immediately. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  await shares().revoke(token);
  return json({ revoked: true });
}
