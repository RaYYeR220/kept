import sharp from "sharp";
import { deltaE00, rgbToLab } from "@kept/likeness";

/**
 * The makeup try-on brightens the whole face slightly (ΔE ≈ 3–4 on the cheeks in our tests,
 * on light and deep skin alike). Kept undoes that global shift: it fits a per-channel
 * gain and offset that maps the render back onto the person's own photo, using only the
 * pixels the render barely changed, and applies it to the whole render. The drawn brows and
 * lashes stay; the skin goes back to the person's own tone.
 */
export async function undoRetouch(original: Uint8Array, render: Uint8Array, stableDE = 8): Promise<{ image: Uint8Array; gain: number[]; offset: number[] }> {
  const r = sharp(render).rotate().removeAlpha();
  const { width, height } = await r.metadata();
  if (!width || !height) throw new Error("Unreadable render");
  const [orig, rend] = await Promise.all([
    sharp(original).rotate().removeAlpha().resize(width, height, { fit: "fill" }).raw().toBuffer(),
    r.raw().toBuffer(),
  ]);

  // Least squares per channel on a sparse grid of stable pixels: orig ≈ gain · rend + offset.
  const sums = [0, 1, 2].map(() => ({ n: 0, sx: 0, sy: 0, sxx: 0, sxy: 0 }));
  const step = Math.max(1, Math.floor(Math.sqrt((width * height) / 40_000)));
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 3;
      const d = deltaE00(rgbToLab(orig[i]!, orig[i + 1]!, orig[i + 2]!), rgbToLab(rend[i]!, rend[i + 1]!, rend[i + 2]!));
      if (d > stableDE) continue;
      for (let k = 0; k < 3; k++) {
        const s = sums[k]!;
        const xv = rend[i + k]!, yv = orig[i + k]!;
        s.n++; s.sx += xv; s.sy += yv; s.sxx += xv * xv; s.sxy += xv * yv;
      }
    }
  }
  const gain: number[] = [], offset: number[] = [];
  for (const s of sums) {
    const den = s.n * s.sxx - s.sx * s.sx;
    const g = s.n > 100 && den !== 0 ? (s.n * s.sxy - s.sx * s.sy) / den : 1;
    gain.push(g);
    offset.push(s.n > 100 ? (s.sy - g * s.sx) / s.n : 0);
  }
  const out = Buffer.alloc(rend.length);
  for (let i = 0; i < rend.length; i += 3) {
    for (let k = 0; k < 3; k++) out[i + k] = Math.max(0, Math.min(255, Math.round(gain[k]! * rend[i + k]! + offset[k]!)));
  }
  const image = await sharp(out, { raw: { width, height, channels: 3 } }).jpeg({ quality: 92 }).toBuffer();
  return { image: new Uint8Array(image), gain, offset };
}
