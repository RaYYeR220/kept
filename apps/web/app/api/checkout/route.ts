import { z } from "zod";
import { shop } from "@/lib/server/env";
import { json } from "@/lib/server/session";

export const runtime = "nodejs";

const Body = z.object({ shopDomain: z.string().regex(/^[a-z0-9.-]+$/i), variantId: z.string().startsWith("gid://shopify/ProductVariant/") });

/** Prepares a UCP checkout at the store and returns its review-and-pay link. Kept never completes a purchase. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: "Unknown product." }, 400);
  try {
    return json(await shop.prepareCheckout(parsed.data));
  } catch (e) {
    return json({ error: "The store couldn't prepare a checkout. You can still open the product page.", detail: (e as Error).message }, 502);
  }
}
