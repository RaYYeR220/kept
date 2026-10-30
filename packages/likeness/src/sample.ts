import type { Lab } from "./colour.ts";

// Hair-colour sampling. YouCam locates the face (free pre-process step); Kept reads the
// colour of the band of hair just above the forehead. Used for the person's own photo and
// for wig listing photos alike, so both sides of a comparison are measured the same way.

export type NormBox = { left: number; top: number; width: number; height: number };
export type PixelRegion = { x0: number; x1: number; y0: number; y1: number };

const MIN_BAND_PX = 8;
const MIN_PIXELS = 30;

/** Band above the forehead, inset 15% from the face edges, between 30% and 6% of a face height above it. */
export function hairRegion(box: NormBox, width: number, height: number): PixelRegion | null {
  const x0 = Math.round((box.left + 0.15 * box.width) * width);
  const x1 = Math.round((box.left + 0.85 * box.width) * width);
  const y0 = Math.max(0, Math.round((box.top - 0.3 * box.height) * height));
  const y1 = Math.round((box.top - 0.06 * box.height) * height);
  if (y1 - y0 < MIN_BAND_PX || x1 - x0 < MIN_BAND_PX) return null;
  return { x0, x1, y0, y1 };
}

/** Median colour after dropping the darkest 10% (deep shadow) and the brightest 40% (shine, background). */
export function robustMedianLab(pixels: Lab[]): Lab | null {
  if (pixels.length < MIN_PIXELS) return null;
  const sorted = [...pixels].sort((p, q) => p.l - q.l);
  const mid = sorted.slice(Math.floor(sorted.length * 0.1), Math.floor(sorted.length * 0.6));
  const median = (k: keyof Lab) => mid.map((p) => p[k]).sort((a, b) => a - b)[Math.floor(mid.length / 2)]!;
  return { l: median("l"), a: median("a"), b: median("b") };
}

/** Plain-language name for a sampled hair colour. */
export function hairShadeName(c: Lab): string {
  const chroma = Math.hypot(c.a, c.b);
  if (chroma < 8 && c.l > 45) return "Grey";
  if (c.l < 12) return "Black";
  if (c.l < 22) return "Dark brown";
  if (c.l < 36) return "Medium brown";
  if (c.l < 52) return c.a > 15 ? "Light auburn brown" : "Light brown";
  if (c.l < 75) return c.a > 20 ? "Copper" : "Dark blonde";
  return "Blonde";
}
