import { describe, expect, it } from "vitest";
import { isComplete, LikenessSchema, summarise, type Likeness } from "../src/schema.ts";

const prov = { api: "face-attr-analysis", version: "v2.0", taskId: "t", units: 10, at: "2026-10-31T10:00:00Z", source: "replay" as const };

const base: Likeness = {
  id: "l1",
  createdAt: "2026-10-31T10:00:00Z",
  status: "complete",
  consent: { at: "2026-10-31T09:59:00Z", textVersion: "2026-10-30" },
  hair: {
    color: { value: { hex: "#5a3d2b", name: "Dark Brown" }, prov },
    type: { value: { mapping: "2a to 2b", term: "Wavy" }, prov },
    length: null,
    density: null,
    frizz: null,
  },
  brows: {
    color: { value: { hex: "#3b2a1e" }, prov },
    shape: { value: { shape: "Soft Angled", thickness: "Average" }, prov },
  },
  skin: { tone: { value: { hex: "#c99d7f" }, prov }, fitzpatrick: null, baseline: null },
  eyes: null,
  lips: null,
  face: null,
};

describe("LikenessSchema", () => {
  it("accepts a well-formed likeness", () => {
    expect(LikenessSchema.parse(base)).toEqual(base);
  });

  it("rejects a non-hex colour", () => {
    const bad = { ...base, hair: { ...base.hair, color: { value: { hex: "brown", name: null }, prov } } };
    expect(LikenessSchema.safeParse(bad).success).toBe(false);
  });

  it("summarise drops consent and keeps every measurement", () => {
    const s = summarise(base);
    expect("consent" in s).toBe(false);
    expect(s.hair.color?.value.hex).toBe("#5a3d2b");
  });

  it("isComplete requires hair colour, brow colour and shape, skin tone", () => {
    expect(isComplete(base)).toBe(true);
    expect(isComplete({ ...base, brows: { ...base.brows, shape: null } })).toBe(false);
  });
});
