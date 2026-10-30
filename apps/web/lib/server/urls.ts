// The server only ever downloads product photos from Shopify's CDN. Anything else a
// client sends is refused, so no route can be used to fetch arbitrary URLs.
const ALLOWED = [/^cdn\.shopify\.com$/i, /^[a-z0-9-]+\.myshopify\.com$/i];

export function isShopImage(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && !u.username && !u.password && (u.port === "" || u.port === "443") && ALLOWED.some((re) => re.test(u.hostname));
  } catch {
    return false;
  }
}

export async function fetchShopImage(raw: string): Promise<Uint8Array> {
  if (!isShopImage(raw)) throw new Error("Only Shopify product photos can be used.");
  const res = await fetch(raw, { redirect: "error", signal: AbortSignal.timeout(15_000) });
  if (!res.ok) throw new Error(`Couldn't load the product photo (${res.status}).`);
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > 12_000_000) throw new Error("The product photo is too large.");
  return new Uint8Array(await res.arrayBuffer());
}
