import { describe, expect, it } from "vitest";
import { deltaE00, hexToLab, labToHex } from "../src/colour.ts";

// Reference pairs from Sharma, Wu & Dalal (2005), "The CIEDE2000 Color-Difference Formula:
// Implementation Notes, Supplementary Test Data, and Mathematical Observations".
const SHARMA: Array<[[number, number, number], [number, number, number], number]> = [
  [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
  [[50, 0, 0], [50, -1, 2], 2.3669],
  [[50, 2.5, 0], [73, 25, -18], 27.1492],
  [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
  [[22.7233, 20.0904, -46.694], [23.0331, 14.973, -42.5619], 2.0373],
  [[90.9257, -0.5406, -0.9208], [88.6381, -0.8985, -0.7239], 1.5381],
];

describe("deltaE00", () => {
  it.each(SHARMA)("matches Sharma 2005 reference %#", (x, y, expected) => {
    const d = deltaE00({ l: x[0], a: x[1], b: x[2] }, { l: y[0], a: y[1], b: y[2] });
    expect(d).toBeCloseTo(expected, 4);
  });

  it("is zero for identical colours and symmetric", () => {
    const c = hexToLab("#6b4a2f");
    expect(deltaE00(c, c)).toBe(0);
    const d = hexToLab("#3b2a1e");
    expect(deltaE00(c, d)).toBeCloseTo(deltaE00(d, c), 10);
  });
});

describe("hexToLab", () => {
  it("maps white and black to the ends of the lightness axis", () => {
    expect(hexToLab("#ffffff").l).toBeCloseTo(100, 1);
    expect(hexToLab("#000000").l).toBeCloseTo(0, 5);
  });

  it("accepts shorthand and missing hash, rejects garbage", () => {
    expect(hexToLab("fff").l).toBeCloseTo(100, 1);
    expect(() => hexToLab("not-a-colour")).toThrow(/hex/i);
  });

  it("round-trips through labToHex", () => {
    expect(labToHex(hexToLab("#6b4a2f"))).toBe("#6b4a2f");
  });
});
