import type { WigCandidate } from "@kept/likeness";

export type ShopWig = WigCandidate & {
  productId: string;
  variantId: string;
  shopDomain: string;
  sellerName: string | null;
  colourName: string | null;
  available: boolean;
  /** Merchant cart permalink — a fallback handoff when a UCP checkout can't be created. */
  cartUrl: string | null;
};

export type WigQuery = { colourWords: string[]; texture: string | null; medical: boolean };

type Option = { name: string; label: string };
type Variant = {
  id: string;
  url?: string;
  price?: { amount: number; currency: string };
  availability?: { available?: boolean };
  options?: Option[];
  seller?: { name?: string; domain?: string };
  checkout_url?: string;
};
type Product = {
  id: string;
  title: string;
  media?: Array<{ type?: string; url: string }>;
  options?: Array<{ name: string; values: Array<{ label: string }> }>;
  metadata?: { tech_specs?: string[] };
  variants?: Variant[];
  price_range?: { min?: { amount: number; currency: string } };
};

const TEXTURE_WORDS = [
  "kinky curly", "kinky straight", "deep wave", "water wave", "loose wave", "body wave",
  "yaki straight", "straight", "curly", "wavy",
];
const COLOUR_WORDS = [
  "natural black", "jet black", "off black", "honey blonde", "ash blonde", "chocolate brown",
  "dark brown", "medium brown", "light brown", "black", "auburn", "copper", "burgundy",
  "blonde", "platinum", "silver", "grey", "gray", "brown",
];

const optionValue = (opts: Option[], re: RegExp) => opts.find((o) => re.test(o.name))?.label ?? null;
const firstWord = (text: string, words: string[]) => words.find((w) => text.toLowerCase().includes(w)) ?? null;

function parseLength(label: string | null): number | null {
  if (!label) return null;
  const m = label.match(/(\d{1,2})(?:\s*(?:inch|in|"|''|”))?/i);
  return m ? Number(m[1]) : null;
}

export function toShopWig(p: Product): ShopWig {
  const v = p.variants?.[0];
  const opts = v?.options ?? [];
  const specTexture = p.metadata?.tech_specs?.find((s) => /^texture\s*:/i.test(s))?.split(":")[1]?.trim() ?? null;
  const texture = optionValue(opts, /hair type|texture/i) ?? firstWord(p.title, TEXTURE_WORDS) ?? specTexture;
  const colourName = optionValue(opts, /colou?r/i) ?? firstWord(p.title, COLOUR_WORDS);
  const lengthIn = parseLength(optionValue(opts, /length/i)) ?? parseLength(p.title.match(/\d{1,2}\s*(inch|in\b|")/i)?.[0] ?? null);
  const price = v?.price ?? p.price_range?.min ?? null;
  return {
    listingId: p.id,
    productId: p.id,
    variantId: v?.id ?? p.id,
    title: p.title,
    url: v?.url ?? "",
    imageUrl: p.media?.find((m) => (m.type ?? "image") === "image")?.url ?? "",
    priceMinor: price?.amount ?? null,
    currency: price?.currency ?? null,
    texture,
    lengthIn,
    measured: null,
    shopDomain: v?.seller?.domain ?? "",
    sellerName: v?.seller?.name ?? null,
    colourName,
    available: v?.availability?.available ?? false,
    cartUrl: v?.checkout_url ?? null,
  };
}

export function buildWigQuery(q: WigQuery): string {
  return [...q.colourWords, q.texture, q.medical ? "medical wig" : "human hair wig"].filter(Boolean).join(" ");
}
