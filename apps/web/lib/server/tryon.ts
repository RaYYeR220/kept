import { deltaE00, hexToLab, matchBrowPattern, type BrowShape } from "@kept/likeness";
import { parseFaceAttr, parseResultUrl, type FeatureKey, type YouCam } from "@kept/youcam";

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

export async function renderBrows(yc: YouCam, photo: Uint8Array, brows: { hex: string; shape: BrowShape | null }, sessionId: string) {
  const [brow, lash] = await Promise.all([patterns("eyebrows"), patterns("eyelashes")]);
  const match = matchBrowPattern(brows.shape ?? { shape: "Obscured", thickness: "Unknown" }, brow);
  const lashPattern = lash.find((p) => /natural/i.test(p.category) || /natural/i.test(p.label)) ?? lash[0];
  const effects: Record<string, unknown>[] = [
    {
      category: "eyebrows",
      pattern: { type: "shape", name: match.name, curvature: match.curvature, thickness: match.thickness, definition: match.definition },
      palettes: [{ color: brows.hex, colorIntensity: 70, texture: "matte" }],
    },
  ];
  if (lashPattern) effects.push({ category: "eyelashes", pattern: { name: lashPattern.label }, palettes: [{ color: "#1c1814", colorIntensity: 55 }] });
  const render = await imageTask(yc, photo, "makeupVto", { version: "1.0", effects }, sessionId);
  return { ...render, pattern: match };
}

export const renderWig = (yc: YouCam, photo: Uint8Array, refUrl: string, sessionId: string) =>
  imageTask(yc, photo, "hairTransfer", { ref_file_url: refUrl, hair_color: "ref" }, sessionId);

export const renderHat = (yc: YouCam, photo: Uint8Array, refUrl: string, gender: "female" | "male", sessionId: string) =>
  imageTask(yc, photo, "hat", { ref_file_url: refUrl, gender }, sessionId);

/**
 * Closes the loop on a brow render: YouCam's Face Analyzer reads the brow colour on the
 * rendered photo, and Kept reports how far it landed from the person's measured brows.
 */
export async function verifyBrows(yc: YouCam, rendered: Uint8Array, targetHex: string, sessionId: string) {
  const { fileId } = await yc.upload(rendered, "image/jpeg", "render.jpg");
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
