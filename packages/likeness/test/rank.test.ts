import { describe, expect, it } from "vitest";
import { rankWigs, textureFamily, type WigCandidate } from "../src/rank.ts";
import type { Provenance } from "../src/provenance.ts";

const prov: Provenance = {
  api: "skin-tone-analysis",
  version: "v2.0",
  taskId: "t1",
  units: 20,
  at: "2026-10-31T10:00:00.000Z",
  source: "replay",
};

function cand(id: string, hex: string | null, extra: Partial<WigCandidate> = {}): WigCandidate {
  return {
    listingId: id,
    title: `Wig ${id}`,
    url: `https://example.com/${id}`,
    imageUrl: `https://example.com/${id}.jpg`,
    priceMinor: 19990,
    currency: "USD",
    texture: "straight",
    lengthIn: 14,
    measured: hex ? { value: { hex }, prov } : null,
    ...extra,
  };
}

const target = { hex: "#5a3d2b", texture: "straight", lengthIn: 14 };

describe("textureFamily", () => {
  it.each([
    ["Body Wave", "wavy"],
    ["2a to 2b", "wavy"],
    ["Straight", "straight"],
    ["Yaki Straight", "straight"],
    ["Water Wave", "curly"],
    ["3b", "curly"],
    ["Kinky Curly", "coily"],
    ["4c", "coily"],
    ["14 inch", null],
    [null, null],
  ])("%s → %s", (input, expected) => {
    expect(textureFamily(input)).toBe(expected);
  });
});

describe("rankWigs", () => {
  it("puts an identical colour first, band close, deltaE 0", () => {
    const [first] = rankWigs(target, [cand("far", "#e8d5a0"), cand("same", "#5a3d2b")]);
    expect(first?.listingId).toBe("same");
    expect(first?.band).toBe("close");
    expect(first?.deltaE).toBe(0);
  });

  it("orders by band, then by deltaE within a band", () => {
    const ranked = rankWigs(target, [
      cand("far", "#e8d5a0"),
      cand("near", "#6e4a33"),
      cand("closest", "#5b3e2c"),
    ]);
    expect(ranked.map((r) => r.listingId)).toEqual(["closest", "near", "far"]);
    expect(ranked.map((r) => r.band)).toEqual(["close", "near", "far"]);
    expect(ranked[0]!.deltaE!).toBeLessThan(ranked[1]!.deltaE!);
  });

  it("always ranks unmeasured listings last and never calls them close", () => {
    const ranked = rankWigs(target, [cand("unknown", null), cand("far", "#e8d5a0")]);
    expect(ranked.at(-1)?.listingId).toBe("unknown");
    expect(ranked.at(-1)?.band).toBe("unmeasured");
    expect(ranked.at(-1)?.deltaE).toBeNull();
    expect(ranked.at(-1)?.reasons).toContain("Colour not measured");
  });

  it("keeps a texture mismatch in the list but says so", () => {
    const [r] = rankWigs(target, [cand("wavy", "#5a3d2b", { texture: "body wave" })]);
    expect(r?.textureMatch).toBe(false);
    expect(r?.reasons.some((s) => /texture/i.test(s))).toBe(true);
  });

  it("reports textureMatch null when either side is unknown", () => {
    const [r] = rankWigs({ ...target, texture: null }, [cand("a", "#5a3d2b")]);
    expect(r?.textureMatch).toBeNull();
  });
});
