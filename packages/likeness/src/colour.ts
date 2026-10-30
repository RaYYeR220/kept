import { converter, differenceCiede2000, formatHex, parse } from "culori";

/** CIELAB under D65, the space every colour comparison in Kept uses. */
export type Lab = { l: number; a: number; b: number };

const toLab65 = converter("lab65");
const de2000 = differenceCiede2000();

export function hexToLab(hex: string): Lab {
  const raw = hex.trim();
  const normalised = raw.startsWith("#") ? raw : `#${raw}`;
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(normalised)) {
    throw new Error(`Not a hex colour: "${hex}"`);
  }
  const lab = toLab65(parse(normalised));
  if (!lab) throw new Error(`Not a hex colour: "${hex}"`);
  return { l: lab.l, a: lab.a, b: lab.b };
}

export function labToHex(lab: Lab): string {
  return formatHex({ mode: "lab65", l: lab.l, a: lab.a, b: lab.b });
}

export function deltaE00(x: Lab, y: Lab): number {
  return de2000({ mode: "lab65", ...x }, { mode: "lab65", ...y });
}

const toLabFromRgb = converter("lab65");

/** 8-bit sRGB → CIELAB (D65). */
export function rgbToLab(r: number, g: number, b: number): Lab {
  const c = toLabFromRgb({ mode: "rgb", r: r / 255, g: g / 255, b: b / 255 });
  return { l: c.l, a: c.a, b: c.b };
}
