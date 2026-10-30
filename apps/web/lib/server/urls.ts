// The server only ever downloads product photos from Shopify's CDN. Anything else a
// client sends is refused, so no route can be used to fetch arbitrary URLs.
const MAX_BYTES = 12_000_000;

export function isShopImage(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && !u.username && !u.password && (u.port === "" || u.port === "443") && u.hostname.toLowerCase() === "cdn.shopify.com";
  } catch {
    return false;
  }
}

/** Downloads a Shopify product photo, counting bytes as they arrive (no trust in headers). */
export async function fetchShopImage(raw: string): Promise<Uint8Array> {
  if (!isShopImage(raw)) throw new Error("Only Shopify product photos can be used.");
  const res = await fetch(raw, { redirect: "error", signal: AbortSignal.timeout(15_000) });
  if (!res.ok || !res.body) throw new Error(`Couldn't load the product photo (${res.status}).`);
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = res.body.getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new Error("The product photo is too large.");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.byteLength;
  }
  return out;
}
