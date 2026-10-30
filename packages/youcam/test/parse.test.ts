import { describe, expect, it } from "vitest";
import {
  parseFaceAttr,
  parseFitzpatrick,
  parseHairDensity,
  parseHairType,
  parseResultUrl,
  parseSkinScores,
  parseSkinTone,
} from "../src/parse.ts";

// Shapes follow the published OpenAPI response schemas; values are illustrative.
describe("parsers", () => {
  it("skin tone: colours lower-cased, names kept, quality read", () => {
    const p = parseSkinTone({
      face_quality: { has_face: true, area: "good", frontal: "good", lighting: "ok", faceangle: "good" },
      color: { skin_color: "#B9947C", eyebrow_color: "#5B2B31", hair_color: "#42280E", hair_color_name: "Brown", eye_color: "#293F9B", eye_color_name: "Blue", lip_color: "#D23245" },
    });
    expect(p).toMatchObject({ skin: "#b9947c", brows: "#5b2b31", hair: "#42280e", hairName: "Brown", eyesName: "Blue" });
    expect(p.quality?.lighting).toBe("ok");
  });

  it("skin tone: missing or malformed colours become null, never invented", () => {
    const p = parseSkinTone({ color: { skin_color: "tan", eyebrow_color: null } });
    expect(p.skin).toBeNull();
    expect(p.brows).toBeNull();
    expect(p.quality).toBeNull();
  });

  it("face attributes: brow shape and thickness from the left brow, face shape", () => {
    const p = parseFaceAttr({
      eyebrow: { left_shape: "Soft Angled", right_shape: "Straight", left_body_thickness: "Average" },
      faceshape: "Oval",
      color: { eyebrow_color: "#4A3222", hair_color: "#42280E", hair_color_name: "Brown" },
    });
    expect(p.browShape).toEqual({ shape: "Soft Angled", thickness: "Average" });
    expect(p.browShapeRight).toBe("Straight");
    expect(p.faceShape).toBe("Oval");
    expect(p.brows).toBe("#4a3222");
  });

  it("hair terms keep both mapping and term", () => {
    expect(parseHairType({ hair_type: { mapping: "2a to 2b", term: "Slight to Medium Wavy" } })).toEqual({ mapping: "2a to 2b", term: "Slight to Medium Wavy" });
    expect(parseHairDensity({ timed: 1.2, hair_density: { mapping: "2.16", term: "Medium Density" } })?.term).toBe("Medium Density");
    expect(parseHairType({})).toBeNull();
  });

  it("fitzpatrick accepts only I–VI", () => {
    expect(parseFitzpatrick({ fitzpatrick_scale: "IV" })).toBe("IV");
    expect(parseFitzpatrick({ fitzpatrick_scale: "VII" })).toBeNull();
  });

  it("skin scores keep whole-face raw scores and skip regions and images", () => {
    const s = parseSkinScores({
      output: [
        { type: "hd_redness", raw_score: 72.01, ui_score: 77, mask_urls: [] },
        { type: "hd_pore", region: "nose", raw_score: 45.7 },
        { type: "hd_pore", region: "whole", raw_score: 51.2 },
        { type: "skin_age", score: 29 },
        { type: "resize_image", mask_urls: ["u"] },
      ],
    });
    expect(s).toEqual({ hd_redness: 72.01, hd_pore: 51.2, skin_age: 29 });
  });

  it("result url from either shape", () => {
    expect(parseResultUrl({ url: "https://r/1.jpg" })).toBe("https://r/1.jpg");
    expect(parseResultUrl({ output: [{ url: "https://r/2.jpg" }] })).toBe("https://r/2.jpg");
    expect(parseResultUrl({})).toBeNull();
  });
});
