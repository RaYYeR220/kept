import { correctTowards, deltaE00, hexToLab, labToHex, matchBrowPattern, shouldStop, type BrowMatch, type BrowShape } from "@kept/likeness";
import { parseFaceAttr, parseFaceBoxes, parseResultUrl, type FeatureKey, type YouCam } from "@kept/youcam";
import sharp from "sharp";
import { undoRetouch } from "./composite";
import { cropToFace } from "./crop";
import { fetchShopImage, isShopImage } from "./urls";

const PATTERNS = "https://plugins-media.makeupar.com/wcm-saas/patterns";
const catalogue = new Map<string, Promise<Array<{ category: string; label: string }>>>();

/** YouCam's public makeup pattern catalogues, fetched once per server instance. */
export function patterns(kind: "eyebrows" | "eyelashes") {
  if (!catalogue.has(kind)) {
    catalogue.set(
      kind,
      fetch(`${PATTERNS}/${kind}.json`)
        .then((r) => r.json() as Promise<Array<{ category: string; label: string }>>)
        .catch((e) => {
          catalogue.delete(kind);
          throw e;
        }),
    );
  }
  return catalogue.get(kind)!;
}

export type Render = { image: Uint8Array; taskId: string; units: number; api: string };

/** Upload the photo, run one image task, download the result, delete the task. */
async function imageTask(yc: YouCam, photo: Uint8Array, feature: FeatureKey, body: Record<string, unknown>, sessionId: string): Promise<Render> {
  const { fileId } = await yc.upload(photo, "image/jpeg", "photo.jpg");
  const out = await yc.run(feature, { src_file_id: fileId, ...body }, { sessionId });
  try {
    const url = parseResultUrl(out.results);
    if (!url) throw new Error("The try-on finished without an image.");
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Couldn't download the try-on (${res.status}).`);
    return { image: new Uint8Array(await res.arrayBuffer()), taskId: out.taskId, units: out.units, api: out.api };
  } finally {
    await yc.deleteTask(out.taskId).catch(() => undefined);
  }
}

export type BrowStrength = { intensity: number; thicknessBoost: number; definition: number };
export const BROW_DEFAULT: BrowStrength = { intensity: 90, thicknessBoost: 0, definition: 60 };
/** Fuller application used by correction rounds: drawn strokes blend less with the skin under them. */
export const BROW_STRONG: BrowStrength = { intensity: 100, thicknessBoost: 20, definition: 85 };

export async function renderBrows(yc: YouCam, photo: Uint8Array, brows: { hex: string; shape: BrowShape | null }, sessionId: string, strength: BrowStrength = BROW_DEFAULT) {
  const [brow, lash] = await Promise.all([patterns("eyebrows"), patterns("eyelashes")]);
  const match = matchBrowPattern(brows.shape ?? { shape: "Obscured", thickness: "Unknown" }, brow);
  const lashPattern = lash.find((p) => /natural/i.test(p.category) || /natural/i.test(p.label)) ?? lash[0];
  const effects: Record<string, unknown>[] = [
    {
      category: "eyebrows",
      pattern: { type: "shape", name: match.name, curvature: match.curvature, thickness: Math.min(100, match.thickness + strength.thicknessBoost), definition: strength.definition },
      palettes: [{ color: brows.hex, colorIntensity: strength.intensity, texture: "matte" }],
    },
  ];
  if (lashPattern) effects.push({ category: "eyelashes", pattern: { name: lashPattern.label }, palettes: [{ color: "#1c1814", colorIntensity: 55 }] });
  const render = await imageTask(yc, photo, "makeupVto", { version: "1.0", effects }, sessionId);
  // Keep the drawn brows and lashes, but put the skin back to the person's own tone.
  const { image } = await undoRetouch(photo, render.image);
  return { ...render, image, pattern: match };
}

/** Hairstyle transfer accepts JPEG up to 1024 px; shop photos are often PNG or WebP and larger. */
async function asJpeg1024(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await sharp(bytes).rotate().resize({ width: 1024, height: 1024, fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 92 }).toBuffer());
}

export async function renderWig(yc: YouCam, photo: Uint8Array, refUrl: string, sessionId: string) {
  const ref = await yc.upload(await asJpeg1024(await fetchShopImage(refUrl)), "image/jpeg", "ref.jpg");
  return imageTask(yc, await asJpeg1024(photo), "hairTransfer", { ref_file_id: ref.fileId, hair_color: "ref" }, sessionId);
}

export async function renderHat(yc: YouCam, photo: Uint8Array, refUrl: string, gender: "female" | "male", sessionId: string) {
  if (!isShopImage(refUrl)) throw new Error("Only Shopify product photos can be used.");
  return imageTask(yc, photo, "hat", { ref_file_url: refUrl, gender }, sessionId);
}

/**
 * Closes the loop on a brow render: YouCam's Face Analyzer reads the brow colour on the
 * rendered photo, and Kept reports how far it landed from the person's measured brows.
 */
export async function verifyBrows(yc: YouCam, rendered: Uint8Array, targetHex: string, sessionId: string) {
  const full = await yc.upload(rendered, "image/jpeg", "render.jpg");
  const pre = await yc.run("facePre", { src_file_id: full.fileId }, { sessionId });
  await yc.deleteTask(pre.taskId).catch(() => undefined);
  const box = parseFaceBoxes(pre.results)[0];
  if (!box) throw new Error("Couldn't find the face on the drawing to check it.");
  const { fileId } = await yc.upload(await cropToFace(rendered, box), "image/jpeg", "render-face.jpg");
  const out = await yc.run("faceAttr", { src_file_id: fileId, features: ["eyebrowColor", "eyebrowShape", "eyebrowThickness"] }, { sessionId });
  await yc.deleteTask(out.taskId).catch(() => undefined);
  const read = parseFaceAttr(out.results);
  return {
    measuredHex: read.brows,
    deltaE: read.brows ? deltaE00(hexToLab(read.brows), hexToLab(targetHex)) : null,
    shape: read.browShape,
    units: out.units,
    taskId: out.taskId,
  };
}

export type CalibrationRound = { round: number; inputHex: string; strength: "default" | "fuller"; measuredHex: string | null; deltaE: number | null; units: number };

/**
 * Draws the brows, has YouCam measure the drawing, and shifts the requested colour by the
 * error until the drawn brows read within ΔE 5 of the person's own (at most `maxRounds`).
 * The measuring API calibrates the rendering API.
 */
export async function calibrateBrows(yc: YouCam, photo: Uint8Array, brows: { hex: string; shape: BrowShape | null }, sessionId: string, maxRounds = 3) {
  const target = hexToLab(brows.hex);
  let input = target;
  const rounds: CalibrationRound[] = [];
  let best: { image: Uint8Array; deltaE: number | null; inputHex: string; pattern: BrowMatch; measuredHex: string | null } | null = null;
  for (let round = 1; ; round++) {
    const inputHex = labToHex(input);
    const strength = round === 1 ? BROW_DEFAULT : BROW_STRONG;
    const r = await renderBrows(yc, photo, { hex: inputHex, shape: brows.shape }, sessionId, strength);
    const v = await verifyBrows(yc, r.image, brows.hex, sessionId);
    rounds.push({ round, inputHex, strength: round === 1 ? "default" : "fuller", measuredHex: v.measuredHex, deltaE: v.deltaE, units: r.units + v.units });
    if (!best || (v.deltaE ?? Infinity) < (best.deltaE ?? Infinity)) {
      best = { image: r.image, deltaE: v.deltaE, inputHex, pattern: r.pattern, measuredHex: v.measuredHex };
    }
    if (v.deltaE === null || !v.measuredHex || shouldStop(v.deltaE, round, maxRounds)) break;
    input = correctTowards(input, target, hexToLab(v.measuredHex));
  }
  return { best: best!, rounds, units: rounds.reduce((s, r) => s + r.units, 0) };
}
