// Parsers from YouCam task results to the plain values Kept stores. Each one tolerates
// missing fields (returns null) instead of inventing a value.

const isHex = (v: unknown): v is string => typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v);
const hex = (v: unknown) => (isHex(v) ? v.toLowerCase() : null);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

export type FaceQuality = { hasFace: boolean; area: string | null; frontal: string | null; lighting: string | null; angle: string | null };

function quality(r: Record<string, unknown>): FaceQuality | null {
  const q = obj(r.face_quality);
  if (!Object.keys(q).length) return null;
  return { hasFace: q.has_face === true, area: str(q.area), frontal: str(q.frontal), lighting: str(q.lighting), angle: str(q.faceangle) };
}

export function parseSkinTone(results: unknown) {
  const r = obj(results);
  const c = obj(r.color);
  return {
    quality: quality(r),
    skin: hex(c.skin_color),
    brows: hex(c.eyebrow_color),
    hair: hex(c.hair_color),
    hairName: str(c.hair_color_name),
    eyes: hex(c.eye_color),
    eyesName: str(c.eye_color_name),
    lips: hex(c.lip_color),
  };
}

/** Left and right brows are read separately; when they disagree, the left one wins and both are kept. */
export function parseFaceAttr(results: unknown) {
  const r = obj(results);
  const b = obj(r.eyebrow);
  const c = obj(r.color);
  const shape = str(b.left_shape) ?? str(b.right_shape);
  const thickness = str(b.left_body_thickness) ?? str(b.right_body_thickness);
  const fs = r.faceshape;
  return {
    quality: quality(r),
    browShape: shape && thickness ? { shape, thickness } : shape ? { shape, thickness: "Unknown" } : null,
    browShapeRight: str(b.right_shape),
    brows: hex(c.eyebrow_color),
    hair: hex(c.hair_color),
    hairName: str(c.hair_color_name),
    faceShape: str(typeof fs === "string" ? fs : obj(fs).shape),
  };
}

const term = (v: unknown) => {
  const o = obj(v);
  const t = str(o.term);
  return t ? { mapping: str(o.mapping), term: t } : null;
};

export const parseHairType = (results: unknown) => term(obj(results).hair_type);
export const parseHairLength = (results: unknown) => term(obj(results).hair_length);
export const parseHairDensity = (results: unknown) => term(obj(results).hair_density);
export const parseHairFrizz = (results: unknown) => term(obj(results).hair_frizziness ?? obj(results).frizziness);

const FITZ = ["I", "II", "III", "IV", "V", "VI"] as const;
export function parseFitzpatrick(results: unknown): (typeof FITZ)[number] | null {
  const v = str(obj(results).fitzpatrick_scale);
  return v && (FITZ as readonly string[]).includes(v) ? (v as (typeof FITZ)[number]) : null;
}

/** Skin Analysis JSON output → raw score per concern (whole-face values only). */
export function parseSkinScores(results: unknown): Record<string, number> | null {
  const out = obj(results).output;
  if (!Array.isArray(out)) return null;
  const scores: Record<string, number> = {};
  for (const item of out) {
    const o = obj(item);
    const type = str(o.type);
    if (!type || type === "resize_image") continue;
    const region = str(o.region);
    if (region && region !== "whole") continue;
    const v = typeof o.raw_score === "number" ? o.raw_score : typeof o.score === "number" ? o.score : null;
    if (v !== null) scores[type] = v;
  }
  return Object.keys(scores).length ? scores : null;
}

/** Image result URL of a try-on task. */
export function parseResultUrl(results: unknown): string | null {
  const r = obj(results);
  return str(r.url) ?? str(obj(Array.isArray(r.output) ? r.output[0] : null).url);
}

export type FaceBox = { left: number; top: number; width: number; height: number };

/** Face boxes from the Fitzpatrick pre-process step, largest first. */
export function parseFaceBoxes(results: unknown): FaceBox[] {
  const list = obj(results).result;
  if (!Array.isArray(list)) return [];
  return list
    .map((b) => obj(b))
    .filter((b) => [b.left, b.top, b.width, b.height].every((v) => typeof v === "number"))
    .map((b) => ({ left: b.left as number, top: b.top as number, width: b.width as number, height: b.height as number }))
    .sort((a, b) => b.width * b.height - a.width * a.height);
}
