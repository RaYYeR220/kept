// Wig colour-name audit: what does a colour name on a wig listing actually look like?
// For each colour name, search the Shop catalogue, read the hair shade on each listing photo
// (YouCam's free pre-process finds the face; Kept samples the band above it), and measure how
// far listings with the same name sit from each other. Writes data/audit-<date>.json.
import { mkdirSync, writeFileSync } from "node:fs";
import { createShop } from "@kept/shop";
import { createYouCam } from "@kept/youcam";
import { deltaE00, hexToLab, labToHex } from "@kept/likeness";
import { sampleHair } from "../../apps/web/lib/server/sample.ts";

const NAMES = ["natural black", "jet black", "dark brown", "medium brown", "chocolate brown", "light brown", "auburn", "honey blonde"];
const PER_NAME = 10;
const yc = createYouCam({ apiKey: process.env.YOUCAM_API_KEY! });
const shop = createShop();

type Row = { name: string; listingId: string; title: string; listedColour: string | null; hex: string | null };
const rows: Row[] = [];
for (const name of NAMES) {
  const wigs = (await shop.searchWigs({ colourWords: name.split(" "), texture: null, medical: false })).slice(0, PER_NAME);
  for (const w of wigs) {
    let hex: string | null = null;
    try {
      const res = await fetch(w.imageUrl);
      if (res.ok) hex = (await sampleHair(yc, new Uint8Array(await res.arrayBuffer()), "audit", true))?.hex ?? null;
    } catch { /* unmeasured */ }
    rows.push({ name, listingId: w.listingId, title: w.title.slice(0, 90), listedColour: w.colourName, hex });
    console.log(name.padEnd(16), hex ?? "—", w.title.slice(0, 60));
  }
}

const groups = NAMES.map((name) => {
  const hexes = rows.filter((r) => r.name === name && r.hex).map((r) => r.hex!);
  const labs = hexes.map(hexToLab);
  const mean = labs.length ? { l: labs.reduce((s, x) => s + x.l, 0) / labs.length, a: labs.reduce((s, x) => s + x.a, 0) / labs.length, b: labs.reduce((s, x) => s + x.b, 0) / labs.length } : null;
  let maxPair = 0;
  for (let i = 0; i < labs.length; i++) for (let j = i + 1; j < labs.length; j++) maxPair = Math.max(maxPair, deltaE00(labs[i]!, labs[j]!));
  return { name, searched: rows.filter((r) => r.name === name).length, measured: hexes.length, meanHex: mean ? labToHex(mean) : null, maxPairDeltaE: Number(maxPair.toFixed(1)) };
});

// How often is a listing closer to another name's average than to its own?
const means = Object.fromEntries(groups.filter((g) => g.meanHex).map((g) => [g.name, hexToLab(g.meanHex!)]));
let crossed = 0, measured = 0;
for (const r of rows.filter((x) => x.hex && means[x.name])) {
  measured++;
  const lab = hexToLab(r.hex!);
  const own = deltaE00(lab, means[r.name]!);
  if (Object.entries(means).some(([n, m]) => n !== r.name && deltaE00(lab, m) < own)) crossed++;
}
const date = new Date().toISOString().slice(0, 10);
const out = { date, method: "Shop Catalog search per colour name (first 10 listings); hair shade read from the first listing photo; face located by YouCam pre-process (0 units).", groups, crossed, measured, rows };
mkdirSync(new URL("../../data/", import.meta.url), { recursive: true });
writeFileSync(new URL(`../../data/audit-${date}.json`, import.meta.url), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ groups, crossed, measured }, null, 1));
