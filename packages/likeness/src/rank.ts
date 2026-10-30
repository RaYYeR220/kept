import { deltaE00, hexToLab } from "./colour.ts";
import type { Measured } from "./provenance.ts";
import { CLOSE_DE00, NEAR_DE00 } from "./thresholds.ts";

export type WigCandidate = {
  listingId: string;
  title: string;
  url: string;
  imageUrl: string;
  priceMinor: number | null;
  currency: string | null;
  texture: string | null;
  lengthIn: number | null;
  /** Hair colour measured by YouCam on the listing's photo; null when it could not be measured. */
  measured: Measured<{ hex: string }> | null;
};

export type ColourBand = "close" | "near" | "far" | "unmeasured";

export type RankedWig = WigCandidate & {
  deltaE: number | null;
  band: ColourBand;
  textureMatch: boolean | null;
  reasons: string[];
};

export type WigTarget = { hex: string; texture: string | null; lengthIn: number | null };

const BAND_ORDER: Record<ColourBand, number> = { close: 0, near: 1, far: 2, unmeasured: 3 };

function bandFor(deltaE: number | null): ColourBand {
  if (deltaE === null) return "unmeasured";
  if (deltaE <= CLOSE_DE00) return "close";
  if (deltaE <= NEAR_DE00) return "near";
  return "far";
}

/** Canonical texture family so "Body Wave" and "body-wave" compare equal. */
export function textureFamily(texture: string | null): string | null {
  if (!texture) return null;
  const t = texture.toLowerCase();
  if (/kink|coil|\b4[abc]\b/.test(t)) return "coily";
  if (/curl|\b3[abc]\b|deep wave|water wave/.test(t)) return "curly";
  if (/wav|\b2[abc]\b/.test(t)) return "wavy";
  if (/straight|yaki|\b1[abc]?\b/.test(t)) return "straight";
  return null;
}

export function rankWigs(target: WigTarget, cands: WigCandidate[]): RankedWig[] {
  const targetLab = hexToLab(target.hex);
  const targetTexture = textureFamily(target.texture);

  const ranked = cands.map((c): RankedWig => {
    const reasons: string[] = [];
    const deltaE = c.measured ? deltaE00(targetLab, hexToLab(c.measured.value.hex)) : null;
    const band = bandFor(deltaE);
    if (deltaE === null) reasons.push("Colour not measured");
    else reasons.push(`Colour ΔE ${deltaE.toFixed(1)} from your measured hair`);

    const candTexture = textureFamily(c.texture);
    const textureMatch = targetTexture && candTexture ? targetTexture === candTexture : null;
    if (textureMatch === false) reasons.push(`Texture differs: ${c.texture} vs your ${target.texture}`);

    return { ...c, deltaE, band, textureMatch, reasons };
  });

  return ranked.sort(
    (x, y) =>
      BAND_ORDER[x.band] - BAND_ORDER[y.band] ||
      (x.deltaE ?? Infinity) - (y.deltaE ?? Infinity) ||
      Number(y.textureMatch === true) - Number(x.textureMatch === true),
  );
}
